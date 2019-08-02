const jwt         = require('jsonwebtoken')
module.exports = ({anonSchema, anonResolvers={}, schema, rootValue={},secret, createContext, graphiql=true}) => 
    async (req, res, gql) => { 
        const authorization = req.headers.authorization 
        
        if (authorization && authorization.startsWith('Bearer ')){
            const token = authorization.substr("Bearer ".length)
            const decoded = jwt.verify(token, secret)
            if (decoded){
                let context  = await createContext(decoded.sub)
                context.jwt  = decoded.sub

                return {
                    schema,
                    rootValue, 
                    graphiql,
                    context
                }
            }
        }
        return {
            schema: anonSchema,
            rootValue: anonResolvers,
            graphiql, 
        }
    }
