const { buildSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLSchema } = require('graphql');
const ObjectID    = require("mongodb").ObjectID;
function mmExpandSchema(gqlSchema){
    const types    = {}
    const _typeMap = gqlSchema.getTypeMap()

    const buildInTypes = ['Query',  'Mutation',  'ID',  'Float',  "String",  'Int',  'Boolean',
                          'Query!', 'Mutation!', 'ID!', 'Float!', "String!", 'Int!', 'Boolean!' ]


    async function argToSavables(arg, outputTypeName, Savable){
        console.log('argToSavables', arg)
        const entity = arg._id ? await Savable.m[outputTypeName].findOne({_id: ObjectID(arg._id)}) :
                                 new Savable.classes[outputTypeName]({})
        const {_id, ...data} = arg;
        const type = _typeMap[outputTypeName + 'Input']
        const fields = type.getFields()

        for(let [fieldName, value] of Object.entries(data)){
            let typeName = fields[fieldName].type.toString()

            if (!buildInTypes.includes(typeName)){
                console.log('recursive', arg[fieldName], typeName)
                if (typeName[0] === '['){
                    const nestedTypeName = typeName.slice(1,-6)
                    console.log('array',nestedTypeName)

                    entity[fieldName] = []
                    for (let nestedArg of value){
                        const nestedEntity = await argToSavables(nestedArg, nestedTypeName, Savable)
                        entity[fieldName].push(nestedEntity)
                    }
                }
                else {
                    const nestedTypeName = typeName.slice(0,-5)
                    console.log('one', nestedTypeName)
                    entity[fieldName] = await argToSavables(value, nestedTypeName, Savable)
                }
            }
            else {
                entity[fieldName] = value
            }
        }
        return await entity.save()
    }


    let queryFields     = _typeMap.Query    ? _typeMap.Query.getFields()    : {}
    let mutationFields  = _typeMap.Mutation ? _typeMap.Mutation.getFields() : {}

    for (let [typeName, type] of Object.entries(_typeMap)) 
        if (!buildInTypes.includes(typeName) && 
            !typeName.startsWith('__')){

            if (typeName.endsWith('Input')){
                let outputTypeName = typeName.substr(0, typeName.length - 'Input'.length)
                if (outputTypeName in _typeMap){
                    types[outputTypeName] = type

                    const find = {
                        type: GraphQLList(_typeMap[outputTypeName]),
                        args: {query: {type: GraphQLString}},
                        async resolve(root, args, context, info){
                            //console.log(root, args, context, info)

                            const Savable = context.models.SlicedSavable || context.models.Savable 
                            args = JSON.parse(args.query)
                            let results = []

                            for (let result of Savable.m[outputTypeName].find(...args)){
                                try {result = await result} catch (e) { break }
                                results.push(result)
                            }
                            return results;
                        }
                    }
                    queryFields[`${outputTypeName}Find`] = find

                    const findOne = {
                        type: _typeMap[outputTypeName],
                        args: {query: {type: GraphQLString}},
                        async resolve(root, args, context, info){
                            //console.log(root, args, context, info)

                            const Savable = context.models.SlicedSavable || context.models.Savable 
                            args = JSON.parse(args.query)
                            let [query] = args
                            if (query._id && typeof query._id === 'string'){
                                query._id = ObjectID(query._id)
                            }
                            let record = Savable.m[outputTypeName].findOne(query, ...args.slice(1))
                            return record;
                        }
                    }
                    queryFields[`${outputTypeName}FindOne`] = findOne


                    const lowerCaseName = outputTypeName[0].toLowerCase() + outputTypeName.slice(1)

                    const del = {
                        type: _typeMap[outputTypeName],
                        args: {[lowerCaseName]: {type: _typeMap[typeName]}},
                        async resolve(root, args, context, info){
                            //console.log(root, args, context, info)

                            const Savable = context.models.SlicedSavable || context.models.Savable 
                            const arg     = args[lowerCaseName]
                            if (! ('_id' in arg)){
                                return null;
                            }
                            let entity = await Savable.m[outputTypeName].findOne({_id: ObjectID(arg._id)})
                            if (entity){
                                let copy = {...record}
                                await entity.delete()
                                return copy;
                            }

                            return entity;
                        }
                    }
                    mutationFields[`${outputTypeName}Delete`] = del

                    const upsert = {
                        type: _typeMap[outputTypeName],
                        args: {[lowerCaseName]: {type: _typeMap[typeName]}},
                        async resolve(root, args, context, info){
                            //console.log(root, args, context, info)

                            const Savable = context.models.SlicedSavable || context.models.Savable 

                            const arg     = args[lowerCaseName]
                            const entity  = argToSavables(args[lowerCaseName], outputTypeName, Savable)

                            return entity;
                        }
                    }
                    mutationFields[`${outputTypeName}Upsert`] = upsert
                }
            }
    }


    let newQuery     = new GraphQLObjectType({name: 'Query', fields: queryFields})
    let newMutation  = new GraphQLObjectType({name: 'Mutation', fields: mutationFields})

    let newSchema = new GraphQLSchema({query: newQuery, mutation: newMutation})
    return newSchema;
}

module.exports = mmExpandSchema
