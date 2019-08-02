MM-Graphql are seamless magic bind tool between Graphql and MemMongo
=====

basic tests:
---

```
type Category {
  _id: ID
  createdAt: String
  name: String!
  goods: [Good]
}

input CategoryInput {
  _id: ID
  name: String
  goods: [GoodInput]
}

type Good {
  _id: ID
  createdAt: String
  name: String!
  description: String
  price: Float
  imgUrls: [String]
  orderGoods: [OrderGood]
  categories: [Category]
}

input GoodInput {
  _id: ID
  name: String
  description: String
  imgUrls: [String]
  price: Float
  categories: [CategoryInput]
}

type Mutation {
  UserDelete(user: UserInput): User
  UserUpsert(user: UserInput): User
  CategoryDelete(category: CategoryInput): Category
  CategoryUpsert(category: CategoryInput): Category
  GoodDelete(good: GoodInput): Good
  GoodUpsert(good: GoodInput): Good
  OrderGoodDelete(orderGood: OrderGoodInput): OrderGood
  OrderGoodUpsert(orderGood: OrderGoodInput): OrderGood
  OrderDelete(order: OrderInput): Order
  OrderUpsert(order: OrderInput): Order
}

type Order {
  _id: ID
  createdAt: String
  orderGoods: [OrderGood]
  total: Float
}

type OrderGood {
  _id: ID
  createdAt: String
  price: Float
  count: Float
  good: Good
  order: Order
  total: Float
}

input OrderGoodInput {
  _id: ID
  count: Int
  good: GoodInput
  order: OrderInput
}

input OrderInput {
  _id: ID
  orderGoods: [OrderGoodInput]
}

type Query {
  UserFind(query: String): [User]
  UserFindOne(query: String): User
  CategoryFind(query: String): [Category]
  CategoryFindOne(query: String): Category
  GoodFind(query: String): [Good]
  GoodFindOne(query: String): Good
  OrderGoodFind(query: String): [OrderGood]
  OrderGoodFindOne(query: String): OrderGood
  OrderFind(query: String): [Order]
  OrderFindOne(query: String): Order
}

type User {
  _id: String
  createdAt: String
  login: String
  nick: String
  orders: [Order]
}

input UserInput {
  _id: String
  login: String
  nick: String
}
```

Mutation and Query section created by boilerplate generator.

queries:
---
```
query mmOrders($query:String){
  OrderFind(query:$query){
    _id,
		orderGoods{
      _id,
			total,
			count,
		  good{
        _id, name, price,
        categories{
          _id, name
        }
      }
    }
  }
}

query mmOrder($queryOne:String){
  OrderFindOne(query:$queryOne){
    _id,
		orderGoods{
      _id
    }
  }
}

mutation mmOrderDel($order:OrderInput){
  OrderDelete(order:$order){
    _id, orderGoods{
      _id
    }
  }
}

mutation mmCategoryUpsert($category:CategoryInput){
	CategoryUpsert(category:$category){
    _id, name, goods{
      _id, name, description
    }
  }
}

query mmGoods{
  GoodFind(query:"[{}]"){
    _id, 
    categories{
      _id, name
    }
  }
}

query mmGood{
  GoodFindOne(query:"[{\"_id\": \"5d43941ddc27227aa3de6aa0\"}]"){
    _id, name 
    categories{
      _id, name
    }
  }
}

query mmCategories{
  CategoryFind(query:"[{}]"){
    _id, name, 
    goods{
      _id, name, description,
			categories{
        _id, name
      }
    }
  }
}

# mutation createUser($login:String!, $password:String!){
#   createUser(login:$login, password:$password){
#     _id, login    
#   }  
# }

# query login($login:String!, $password:String!){
#   login(login:$login, password:$password)
# }

# mutation pwd($password:String!){
#   changePassword(password: $password){
#     _id, login
# 	}
# }
```

Variables:
---
```
{
"queryOne": "[{\"_id\": \"5d388f0786f70ff605a78700\"}]",
"query": "[{}]",
 "order": {
    "_id": "5d38f2ce524e8382d111556e"  #для удаления
  },

  "category": {    //нет id - новая категория
    "name": "smth", //название новой категории
		"goods": [  //товары новой категории
      {"_id": "5d390368355751480651ed19"},  //id есть - существующий товар
		  {"name": "new smth"}              //новый товар
    ]
  },
}

