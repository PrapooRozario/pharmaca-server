require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors());
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const uri = `mongodb+srv://albart2022:albart_2024@cluster0.qgpkx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Failed to authenticate token" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    const productsCollection = client.db("Pharmaca").collection("Products");
    const usersCollection = client.db("Pharmaca").collection("Users");
    const cartsCollection = client.db("Pharmaca").collection("Carts");
    const categoryCollection = client.db("Pharmaca").collection("Categories");
    const paymentsCollection = client.db("Pharmaca").collection("Payments");

    // Get All Products API
    app.get("/products", async (req, res) => {
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.skip) || 1;
      const sort = req.query.sort;
      const search = {
        $or: [
          { itemName: { $regex: req.query.search || "", $options: "i" } },
          { company: { $regex: req.query.search || "", $options: "i" } },
          {
            itemGenericName: { $regex: req.query.search || "", $options: "i" },
          },
          { category: { $regex: req.query.search || "", $options: "i" } },
        ],
      };
      const result = await productsCollection
        .find(search)
        .limit(limit)
        .skip(page)
        .sort(
          sort === "desc"
            ? { perUnitPrice: -1 }
            : sort === "asc"
            ? { perUnitPrice: 1 }
            : {}
        )
        .toArray();
      const productsCount = await productsCollection.countDocuments(search);
      res.status(200).json({
        products: result,
        productsCount: productsCount,
      });
    });

    //  Products Discount API
    app.get("/products/discounted", async (req, res) => {
      const result = await productsCollection
        .find({ discountPercentage: { $gt: 0 } })
        .toArray();
      res.status(200).send(result);
    });

    // Recommended Products API
    app.get("/products/recommended", async (req, res) => {
      const result = await productsCollection
        .find({ discountPercentage: { $eq: 0 } })
        .limit(6)
        .toArray();
      res.status(200).send(result);
    });

    // Products Cart Add
    app.post("/products/carts", verifyToken, async (req, res) => {
      const cart = req?.body;
      if (req?.user?.email !== cart?.email)
        return res.status(403).send({ message: "Forbidden" });
      const result = await cartsCollection.updateOne(
        { $and: [{ productId: cart?.productId }, { email: cart?.email }] },
        { $setOnInsert: cart },
        { upsert: true }
      );
      if (result.upsertedCount > 0) {
        res.status(201).send(result);
      } else {
        res
          .status(400)
          .send({ message: "Product already exists in your cart." });
      }
    });
    //  User Product Carts with More Details
    app.get("/products/carts", verifyToken, async (req, res) => {
      const email = req?.user?.email;
      if (email !== req?.query?.email)
        return res.status(403).send({ message: "Forbidden" });
      const result = await cartsCollection
        .aggregate([
          {
            $match: { email: email },
          },
          {
            $lookup: {
              from: "Products",
              localField: "productId",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          {
            $unwind: "$productDetails",
          },
          {
            $addFields: {
              totalPrice: {
                $multiply: ["$quantity", "$productDetails.perUnitPrice"],
              },
            },
          },
          {
            $group: {
              _id: null,
              allProducts: {
                $push: {
                  productId: "$productDetails._id",
                  quantity: "$quantity",
                  itemName: "$productDetails.itemName",
                  perUnitPrice: "$productDetails.perUnitPrice",
                  discountPercentage: "$productDetails.discountPercentage",
                  company: "$productDetails.company",
                  _id: "$_id",
                  totalPrice: "$totalPrice",
                },
              },
              totalCartPrice: {
                $sum: "$totalPrice",
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalCartPrice: 1,
              allProducts: 1,
            },
          },
        ])
        .toArray();
      res.status(200).json(result[0]);
    });

    //  Delete Cart
    app.delete("/products/carts/:id", verifyToken, async (req, res) => {
      const email = req?.user?.email;
      if (email !== req?.query?.email)
        return res.status(403).send({ message: "Forbidden" });
      const cartProductId = req?.params?.id;
      const result = await cartsCollection.deleteOne({
        _id: new ObjectId(cartProductId),
      });
      res.status(200).send(result);
    });

    //  Quantity Update
    app.put("/products/cart/:id", verifyToken, async (req, res) => {
      if (req?.user?.email !== req?.query?.email)
        return res.status(403).send({ message: "Forbidden" });
      const { quantity } = req?.body;
      const result = await cartsCollection.updateOne(
        { _id: new ObjectId(req?.params?.id) },
        {
          $inc: { quantity: quantity },
        }
      );

      res.status(200).send(result);
    });
    //  Delete User All Carts
    app.delete("/products/carts", async (req, res) => {
      const result = await cartsCollection.deleteMany({
        email: req?.query?.email,
      });
      res.status(200).send(result);
    });

    // Category API
    app.get("/products/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.status(200).send(result);
    });

    app.get("/products/category/:category", async (req, res) => {
      const category = req?.params?.category;
      const result = await productsCollection
        .find({ category: category })
        .toArray();
      res.status(200).send(result);
    });

    // Users API
    app.post("/users", async (req, res) => {
      const user = req?.body;
      const result = await usersCollection.updateOne(
        {
          email: user?.email,
        },
        { $setOnInsert: user },
        { upsert: true }
      );
      if (result?.upsertedCount > 0) {
        res.status(201).send(result);
      } else {
        res.status(400).send({ message: "User already exists" });
      }
    });

    //  Stripe Payment
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { amount } = req.body;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.status(200).send({ clientSecret: paymentIntent?.client_secret });
      } catch {
        res.status(500).send({ error: error.message });
      }
    });

    // Payments API
    app.post("/products/payments", verifyToken, async (req, res) => {
      const paymentDetails = req?.body;
      const result = await paymentsCollection.insertOne(paymentDetails);
      res.status(201).send(result);
    });

    // Dashboard Statistics
    app.get("/dashboard/statistics", async (req, res) => {
      const totalOrders = await paymentsCollection.estimatedDocumentCount();
      const totalPending = await paymentsCollection.countDocuments({
        status: "pending",
      });
      const totalPaid = await paymentsCollection.countDocuments({
        status: "paid",
      });
      res.status(200).send({ totalOrders, totalPending, totalPaid });
    });

    // JWT API
    app.post("/jwt", async (req, res) => {
      const user = req?.body;
      const token = jwt.sign(user, process.env.JWT_SECRET_TOKEN, {
        expiresIn: "1d",
      });
      res.status(200).send(token);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
