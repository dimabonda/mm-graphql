const ObjectID    = require("mongodb").ObjectID;
const jwt         = require('jsonwebtoken')
const jwtSecret   = 'CbymrfGfnB'

const express = require('express');
const express_graphql = require('express-graphql');

const { buildSchema, printSchema } = require('graphql');
const expand = require('./expand')

;(async () => {

    const {Savable, slice, getModels} = await require('./models.js')()
    const jwtGQL = require('./jwt')

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

    schema = expand(schema)
    console.log(printSchema(schema))




    class User extends Savable {

    }
    Savable.addClass(User)

    const anonResolvers = {
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

        changePassword:async function ({login, password, newPassword}){
            const user =  await Savable.m.User.findOne({login, password})
            if (!user) return null;
            user.password = newPassword;
            return await user.save()
        },
    }

    const anonSchema = buildSchema(`
        type Query {
            login(login: String!, password: String!): String
        }
        type Mutation {
            createUser(login: String!, password: String!): User
            changePassword(login: String!, password: String!, newPassword: String!): User
        }

        type User {
             _id: String
             createdAt: String
             login: String
             nick : String
        }

    `)

    const app = express();
    app.use(express.static('public'));
    app.use('/graphql', express_graphql(jwtGQL({anonSchema, anonResolvers, schema, createContext: getModels, graphiql: true, secret: jwtSecret})))
    app.listen(4000, () => console.log('Express GraphQL Server Now Running On localhost:4000/graphql'));
})()

