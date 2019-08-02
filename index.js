const ObjectID    = require("mongodb").ObjectID;
const jwt         = require('jsonwebtoken')
const jwtSecret   = 'CbymrfGfnB'

const express = require('express');
const express_graphql = require('express-graphql');
const { buildSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLSchema} = require('graphql');
const { buildASTSchema, parseSchemaIntoAST } = require('graphql/utilities');

const anonResolvers = ['login', 'createUser'];


function mmExpandSchema(gqlSchema){
    const types = {}
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
                    const nestedTypeName = typeName.slice(0,-6)
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


;(async () => {
    const {Savable, slice, getModels} = await require('./models.js')()

    class User extends Savable {
        static get relations(){
            return {
            }
        }
    }
    Savable.addClass(User)


    let schema = buildSchema(`
        type User {
             _id: String
             createdAt: String
             login: String
             nick : String
             orders: [Order]
        }

        input UserInput {
             _id: String
             login: String
             nick : String
        }

        type Category {
            _id: ID,
            createdAt: String
            name: String!,
            goods: [Good]
        }
        input CategoryInput {
            _id: ID,
            name: String,
            goods: [GoodInput]
        }

        type Good {
            _id: ID,
            createdAt: String
            name: String!,
            description: String
            price: Float
            imgUrls: [String]
            orderGoods: [OrderGood]
            categories: [Category]
        }

        input GoodInput {
            _id: ID,
            name: String,
            description: String
            imgUrls: [String]
            price: Float
            categories: [CategoryInput]
        }


        type OrderGood {
            _id: ID,
            createdAt: String
            price: Float,
            count: Float,
            good: Good,
            order: Order
            total: Float
        }

        input OrderGoodInput {
            _id: ID,
            count: Int,
            good: GoodInput,
            order: OrderInput
        }


        type Order {
            _id: ID
            createdAt: String
            orderGoods: [OrderGood]
            total: Float
        }

        input OrderInput {
            _id: ID
            orderGoods: [OrderGoodInput]
        }

    `);

    schema = mmExpandSchema(schema)

    //console.log(schema._typeMap.User.__proto__)
    //console.log(schema._typeMap.OrderInput.getFields())

    var app = express();
    app.use(express.static('public'));

    const rootResolvers = {
        createUser:async function ({login, password}){
            let user =  await Savable.m.User.findOne({login, password})
            if (user)
                return null;
            user = await (new User({login, password})).save()

            user.___owner = user._id.toString()
            user.___permissions = {
                read: ["owner", "user"]
            }

            return await user.save()
        },

        login: async function({login, password}){
            console.log(Savable.classes)
            const user =  await Savable.m.User.findOne({login, password})
            if (!user)
                return null;

            const token = jwt.sign({ sub: {id: user._id, login}}, jwtSecret); //подписывам токен нашим ключем
            return token
        },

        changePassword:async function ({password}, {jwt: {id}, models: {SlicedSavable, User}} ){
            id = new ObjectID(id)

            const user =  await SlicedSavable.m.User.findOne({_id: id})
            if (!user)
                return null;
            user.password = password;
            return await user.save()
        },

        async setCategory({cat}, {jwt: {id}, models: {SlicedSavable, Category}}){
            if ('_id' in cat){
                let entity = await SlicedSavable.m.Category.findOne({_id: ObjectID(cat._id)})
                console.log(entity)
                if (entity){
                    entity.name = cat.name
                    if (cat.goods){
                        entity.goods = []
                        for (goodId of cat.goods){
                            let good = await SlicedSavable.m.Good.findOne({_id: ObjectID(goodId)});
                            good && entity.goods.push(good)
                        }
                    }
                    return await entity.save()
                }
            }
            return await (new Category(cat)).save()
        },

        async categories({}, {jwt: {id}, models: {SlicedSavable, Category}}){
            let categories = []
            for (let category of SlicedSavable.m.Category.find({})){
                try {category = await category} catch (e) { break }
                categories.push(category)
            }
            return categories;
        },

        async category({_id}, {jwt: {id}, models: {SlicedSavable, Category}}){
            return await SlicedSavable.m.Category.findOne({_id: ObjectID(_id)});
        },


        async setGood({good}, {jwt: {id}, models: {SlicedSavable, Good}}){
            let entity;
            if ('_id' in good){
                entity = await SlicedSavable.m.Good.findOne({_id: ObjectID(good._id)})
                if (entity){
                    entity.name         = good.name
                    entity.description  = good.description
                    entity.price        = good.price      
                }
            }
            entity = entity || new Good(good)
            if (good.categories){
                console.log(good.categories)
                entity.categories = []
                for (catId of good.categories){
                    let cat = await SlicedSavable.m.Category.findOne({_id: ObjectID(catId)});
                    cat && entity.categories.push(cat)
                }
            }
            return await entity.save()
        },

        async goods({}, {jwt: {id}, models: {SlicedSavable, Good}}){
            goods = []
            for (let good of SlicedSavable.m.Good.find({})){
                try {good = await good} catch (e) { break }
                goods.push(good)
            }
            return goods;
        },

        async good({_id}, {jwt: {id}, models: {SlicedSavable, Good}}){
            return await SlicedSavable.m.Good.findOne({_id: ObjectID(_id)});
        },



        async setOrder({order}, {jwt: {id}, models: {SlicedSavable, Order, thisUser}}){
            let entity;
            if ('_id' in order){
                entity = await SlicedSavable.m.Order.findOne({_id: ObjectID(order._id)})
            }
            entity = entity || new Order(order)
            if (order.orderGoods){
                entity.orderGoods = []
                for (orderGoodId of order.orderGoods){
                    let orderGood = await SlicedSavable.m.OrderGood.findOne({_id: ObjectID(orderGoodId)});
                    orderGood && entity.orderGoods.push(orderGood)
                }
            }
            console.log(entity.orderGoods)
            entity.user = thisUser
            return await entity.save()
        },

        async orders({}, {jwt: {id}, models: {SlicedSavable}}){
            orders = []
            for (let order of SlicedSavable.m.Order.find({})){
                try {order = await order} catch (e) { break }
                orders.push(order)
            }
            return order;
        },

        async myOrders({}, {jwt: {id}, models: {SlicedSavable}}){
            orders = []
            for (let order of SlicedSavable.m.Order.find({___owner: id.toString(id)})){
                try {order = await order} catch (e) { break }
                orders.push(order)
            }
            return orders;
        },

        async order({_id}, {jwt: {id}, models: {SlicedSavable, Good}}){
            return await SlicedSavable.m.Order.findOne({_id: ObjectID(_id)});
        },



        async setOrderGood({orderGood}, {jwt: {id}, models: {SlicedSavable, OrderGood, thisUser}}){
            let order  = await SlicedSavable.m.Order.findOne({'_id': ObjectID(orderGood.order)})
            let good   = await SlicedSavable.m.Good.findOne ({'_id': ObjectID(orderGood.good)})
            if (order && good){
                let entity = await SlicedSavable.m.OrderGood.findOne({'order._id': order._id,
                                                                         'good._id':  good._id})
                if (!entity){
                    console.log('wtf')
                    entity = new OrderGood({})
                }

                entity.price = good.price
                entity.count = orderGood.count
                entity.order = order
                entity.good  = good
                await entity.save()
                console.log(entity)

                return entity
            }
            return null;
        },
    }

    app.use('/graphql', express_graphql(async (req, res, gql) => { 
        if (!gql.query){
            return {
                schema: schema,
                rootValue: (...params) => (console.log(params), rootResolvers),
                graphiql: true, 
            }
        }
        const operationMatch = gql.query.match(/\{\s*([a-zA-Z]+)\s*/)
        const operationName  = gql.operationName || operationMatch[1]
        console.log('before oper', operationName)
        if ((!operationName) || anonResolvers.includes(operationName)){
            return {
                schema: schema,
                rootValue: rootResolvers,
                graphiql: true, 
            }
        }
        const authorization = req.headers.authorization 
        console.log(authorization)
        
        if (authorization && authorization.startsWith('Bearer ')){
            console.log('token provided')
            const token = authorization.substr("Bearer ".length)
            const decoded = jwt.verify(token, jwtSecret)
            if (decoded){
                console.log('token verified', decoded)

                let slicedModels  = await getModels(decoded.sub.id)

                return {
                    schema: schema,
                    rootValue: rootResolvers,
                    graphiql: true, 
                    context: {jwt: decoded.sub,
                              models: slicedModels}
                }
            }
        }
        console.log('bad end')
    }))

    app.listen(4000, () => console.log('Express GraphQL Server Now Running On localhost:4000/graphql'));
})()

