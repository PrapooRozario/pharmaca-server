require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors());

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

    // Get All Products API
    app.get("/products", async (req, res) => {
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.skip) || 1;
      const sort = req.query.sort;
      const search = {
        $or: [
          { itemName: { $regex: req.query.search, $options: "i" } },
          { company: { $regex: req.query.search, $options: "i" } },
          { itemGenericName: { $regex: req.query.search, $options: "i" } },
          { category: { $regex: req.query.search, $options: "i" } },
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
      console.log(productsCount);
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

    // Users API
    app.post("/users", async (req, res) => {
      const user = req?.body;
      const existingUser = await usersCollection.findOne({
        email: user?.email,
      });
      if (existingUser) return;
      const result = await usersCollection.insertOne(user);
      res.status(201).send(result);
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
