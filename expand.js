const { buildSchema, GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLList, GraphQLSchema } = require('graphql');
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

        let changed = !_id

        for(let [fieldName, value] of Object.entries(data)){
            let typeName = fields[fieldName].type.toString()

            if (!buildInTypes.includes(typeName)){
                console.log('recursive', arg[fieldName], typeName)
                changed = true
                if (typeName[0] === '['){
                    const nestedTypeName = typeName.slice(1,-6)
                    console.log('array',nestedTypeName)

                    entity[fieldName] = []
                    if (value) for (let nestedArg of value){
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
        changed && await entity.save()
        return entity
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

                    const queryUpdater = query => {
                        const checkers = [
                            function objectID(val){
                                if (val && typeof val === 'string' && val.length == 24){
                                    try {
                                        const id = ObjectID(val)
                                        if (id.toString() === val) return id
                                    }
                                    catch (e){
                                        return val
                                    }
                                }
                                return val
                            },

                            function regexp(val){
                                if (val && typeof val === 'string' && val.startsWith('/') && val.endsWith('/')){
                                    try {
                                        return new Regexp(val.slice(1,-1))
                                    }
                                    catch (e){
                                        return val
                                    }
                                }
                                return val
                            },
                        ]

                        const checker = val => {
                            const originalVal = val
                            for (let lambda of checkers){
                                val = lambda(val)
                            }
                            return val !== originalVal && val 
                        }

                        const walker = obj =>{
                            for (let [key, value] of Object.entries(obj)){
                                let newValue;
                                if (newValue = checker(value))    obj[key] = newValue;
                                else if (newValue && typeof newValue === 'object'){
                                    obj[key] = walker(value)
                                }
                            }
                            return obj
                        }
                    }

                    const find = {
                        type: GraphQLList(_typeMap[outputTypeName]),
                        args: {query: {type: GraphQLString}},
                        async resolve(root, args, context, info){
                            //console.log(root, args, context, info)

                            const Savable = context.models.SlicedSavable || context.models.Savable 
                            args = JSON.parse(args.query)
                            walker(args[0])
                            console.log(args)
                            let results = []

                            for (let result of Savable.m[outputTypeName].find(...args)){
                                try {result = await result} catch (e) { break }
                                results.push(result)
                            }
                            return results;
                        }
                    }
                    queryFields[`${outputTypeName}Find`] = find

                    const count = {
                        type: GraphQLInt,
                        args: {query: {type: GraphQLString}},
                        async resolve(root, args, context, info){
                            const Savable = context.models.SlicedSavable || context.models.Savable 
                            args = JSON.parse(args.query)
                            return await Savable.m[outputTypeName].count(...args)
                        }
                    }
                    queryFields[`${outputTypeName}Count`] = count

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
                                let copy = {...entity}
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
