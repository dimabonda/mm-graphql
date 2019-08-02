const { buildSchema } = require('graphql');
const jwt         = require('jsonwebtoken')
module.exports = ({Savable, secret}) => {
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

            const token = jwt.sign({ sub: {id: user._id, login}}, secret); //подписывам токен нашим ключем
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
    return {anonResolvers, anonSchema}
}
