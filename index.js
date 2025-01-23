require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const moment = require("moment");
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

const usersCollection = client.db("Pharmaca").collection("Users");
const productsCollection = client.db("Pharmaca").collection("Products");
const cartsCollection = client.db("Pharmaca").collection("Carts");
const categoryCollection = client.db("Pharmaca").collection("Categories");
const paymentsCollection = client.db("Pharmaca").collection("Payments");
const bannersCollection = client.db("Pharmaca").collection("Banners");

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

const verifyAdmin = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req?.user?.email });
  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Forbidden" });
  }
  next();
};

const verifySeller = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req?.user?.email });
  if (user?.role !== "seller") {
    return res.status(403).send({ message: "Forbidden" });
  }
  next();
};

async function run() {
  try {
    // Get All Products API
    app.get("/products", async (req, res) => {
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * limit;
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
        .skip(skip)
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

    app.post("/products", verifyToken, verifySeller, async (req, res) => {
      const product = req?.body?.newData;
      const result = await productsCollection.updateOne(
        {
          $and: [
            { itemName: product?.itemName },
            { shortDescription: product?.shortDescription },
          ],
        },
        { $setOnInsert: product },
        {
          upsert: true,
        }
      );
      if (result.upsertedCount > 0) {
        res.status(201).send(result);
      } else {
        res
          .status(400)
          .send({ message: "Product already exists in your shop." });
      }
    });

    app.get(
      "/products/dashboard/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const result = await productsCollection
          .find({
            email: req?.params?.email,
          })
          .toArray();
        res.status(200).send(result);
      }
    );

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
      const email = req?.query?.email;
      if (req?.user?.email !== email)
        return res.status(403).send({ message: "Forbidden" });
      const carts = await cartsCollection.find({ email: email }).toArray();
      const productIds = carts.map((cart) => cart?.productId);
      const products = await productsCollection
        .find({
          _id: { $in: productIds.map((id) => new ObjectId(id)) },
        })
        .toArray();
      let totalCartPrice = 0;
      const allProducts = carts.map((cart) => {
        const product = products.find((p) => p._id.equals(cart.productId));
        const perUnitPrice = product?.perUnitPrice || 0;
        const totalPrice = cart.quantity * perUnitPrice;
        totalCartPrice += totalPrice;

        return {
          productId: cart.productId,
          quantity: cart.quantity,
          itemName: product?.itemName || "Unknown",
          perUnitPrice,
          discountPercentage: product?.discountPercentage || 0,
          company: product?.company || "Unknown",
          _id: cart._id,
          totalPrice,
        };
      });
      res.status(200).json({ allProducts, totalCartPrice });
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
    app.delete("/products/carts", verifyToken, async (req, res) => {
      const result = await cartsCollection.deleteMany({
        email: req?.query?.email,
      });
      res.status(200).send(result);
    });

    // Post Category API
    app.post("/products/categories", verifyToken, async (req, res) => {
      const { newData } = req?.body;
      const result = await categoryCollection.insertOne(newData);
      res.status(201).send(result);
    });

    // Category API
    app.get("/products/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.status(200).send(result);
    });

    // Delete Category API
    app.delete(
      "/products/categories/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await categoryCollection.deleteOne({
          _id: new ObjectId(req?.params?.id),
        });
        res.status(200).send(result);
      }
    );

    //  Update Category API
    app.patch(
      "/products/categories/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { updatedData } = req?.body;
        const result = await categoryCollection.updateOne(
          { _id: new ObjectId(req?.params?.id) },
          {
            $set: {
              categoryImage: updatedData?.categoryImage,
              categoryName: updatedData?.categoryName,
            },
          }
        );
        res.status(201).send(result);
      }
    );

    // Get Category wise Products API
    app.get("/products/category/:category", verifyToken, async (req, res) => {
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

    app.get("/products/payments", verifyToken, async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.status(200).send(result);
    });

    app.patch(
      "/products/payments/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await paymentsCollection.updateOne(
          { _id: new ObjectId(req?.params?.id) },
          { $set: { status: "paid" } }
        );
        res.status(201).send(result);
      }
    );

    app.get("/products/sales", verifyToken, verifyAdmin, async (req, res) => {
      const startDate =
        req?.query?.startDate && new Date(req?.query?.startDate).toISOString();
      const endDate =
        req?.query?.endDate && new Date(req?.query?.endDate).toISOString();
      const sales = await paymentsCollection
        .aggregate([
          {
            $match: {
              createdAt: {
                $gte: startDate || "1970-01-01T00:00:00Z",
                $lte: endDate || new Date().toISOString(),
              },
            },
          },
          {
            $addFields: {
              productObjectIds: {
                $map: {
                  input: "$productIds",
                  as: "productId",
                  in: { $toObjectId: "$$productId" },
                },
              },
            },
          },
          {
            $lookup: {
              from: "Products",
              localField: "productObjectIds",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $unwind: "$product",
          },
          {
            $addFields: {
              productPrice: {
                $arrayElemAt: [
                  "$productPrices",
                  {
                    $indexOfArray: [
                      "$productIds",
                      { $toString: "$product._id" },
                    ],
                  },
                ],
              },
            },
          },
          {
            $project: {
              "product.itemName": 1,
              email: 1,
              status: 1,
              productPrice: 1,
              "product.email": 1,
            },
          },
        ])
        .toArray();
      res.status(200).send(sales);
    });

    app.get(
      "/products/banners/admin",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await bannersCollection.find().toArray();
        res.status(200).send(result);
      }
    );

    app.get(
      "/products/banners/seller/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const result = await bannersCollection
          .find({ email: req?.params?.email })
          .toArray();
        res.status(200).send(result);
      }
    );

    app.get("/products/banners", async (req, res) => {
      const result = await bannersCollection
        .find({ status: "active" })
        .limit(10)
        .toArray();
      res.status(200).send(result);
    });

    app.post(
      "/products/banners",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const banner = req?.body;
        const result = await bannersCollection.updateOne(
          {
            $or: [
              { bannerName: banner?.bannerName },
              { description: banner?.description },
            ],
          },
          { $setOnInsert: banner },
          { upsert: true }
        );
        console.log(result);
        if (result?.upsertedCount > 0) {
          res.status(201).send(result);
        } else {
          res.status(400).send({ message: "Banner already exists" });
        }
      }
    );

    app.patch(
      "/products/banners",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id, status } = req?.body;
        console.log(id, status);
        const result = await bannersCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: { status: status },
          }
        );

        res.status(201).send(result);
      }
    );

    // Dashboard Statistics
    app.get("/dashboard/admin/statistics", async (req, res) => {
      const result = await paymentsCollection
        .aggregate([
          {
            $lookup: {
              from: "Products",
              localField: "productIds",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $project: {
              status: 1,
              totalAmount: 1,
            },
          },
          {
            $group: {
              _id: "$status",
              totalAmount: { $sum: "$totalAmount" },
            },
          },
        ])
        .toArray();

      const totalPendingAmount = result
        ?.filter((res) => res?._id === "pending")
        .reduce((acc, curr) => acc + curr.totalAmount, 0);

      const totalPaidAmount = result
        ?.filter((res) => res?._id === "paid")
        .reduce((acc, curr) => acc + curr.totalAmount, 0);

      res.status(200).send({ totalPendingAmount, totalPaidAmount });
    });

    app.get("/products/payments/seller/:email", async (req, res) => {
      const email = req?.params?.email;
      const result = await paymentsCollection
        .aggregate([
          {
            $addFields: {
              productObjectIds: {
                $map: {
                  input: "$productIds",
                  as: "productId",
                  in: { $toObjectId: "$$productId" },
                },
              },
            },
          },
          {
            $lookup: {
              from: "Products",
              localField: "productObjectIds",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $unwind: "$product",
          },
          {
            $match: {
              "product.email": email,
            },
          },
          {
            $project: {
              productIds: 1,
              productPrices: 1,
              status: 1,
              product: 1,
              productObjectIds: 1,
              username: 1,
              email: 1,
            },
          },
          {
            $addFields: {
              price: {
                $let: {
                  vars: {
                    index: {
                      $indexOfArray: ["$productObjectIds", "$product._id"],
                    },
                  },
                  in: {
                    $arrayElemAt: ["$productPrices", "$$index"],
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: "$status",
              totalAmount: { $sum: "$price" },
              buyer: { $push: { username: "$username", email: "$email" } },
            },
          },
        ])
        .toArray();
      res.status(200).send(result);
    });

    // Dashboard Seller Statistics
    app.get("/dashboard/seller/statistics/:email", async (req, res) => {
      const email = req?.params?.email;
      const result = await paymentsCollection
        .aggregate([
          {
            $addFields: {
              productObjectIds: {
                $map: {
                  input: "$productIds",
                  as: "productId",
                  in: { $toObjectId: "$$productId" },
                },
              },
            },
          },
          {
            $lookup: {
              from: "Products",
              localField: "productObjectIds",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $unwind: "$product",
          },
          {
            $match: {
              "product.email": email,
            },
          },
          {
            $project: {
              productIds: 1,
              productPrices: 1,
              status: 1,
              product: 1,
              productObjectIds: 1,
            },
          },
          {
            $addFields: {
              price: {
                $let: {
                  vars: {
                    index: {
                      $indexOfArray: ["$productObjectIds", "$product._id"],
                    },
                  },
                  in: {
                    $arrayElemAt: ["$productPrices", "$$index"],
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: "$status",
              totalAmount: { $sum: "$price" },
            },
          },
        ])
        .toArray();
      const totalPendingAmount = result
        ?.filter((res) => res?._id === "pending")
        .reduce((acc, curr) => acc + curr.totalAmount, 0);

      const totalPaidAmount = result
        ?.filter((res) => res?._id === "paid")
        .reduce((acc, curr) => acc + curr.totalAmount, 0);
      console.log(totalPendingAmount, totalPaidAmount);
      res.status(200).send({ totalPendingAmount, totalPaidAmount });
    });

    // All Users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.status(200).send(users);
    });

    // Users role API
    app.patch("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      if (req?.user?.email !== req?.params?.email)
        return res.status(403).send({ message: "Forbidden" });
      const { role, email: user_email } = req?.body;
      const result = await usersCollection.updateOne(
        { email: user_email },
        { $set: { role: role } }
      );
      res.status(201).send(result);
    });

    // Check Admin
    app.get("/admin/:email", verifyToken, async (req, res) => {
      if (req?.user?.email !== req?.params?.email)
        return res.status(403).send({ message: "Forbidden" });
      let admin = false;
      const user = await usersCollection.findOne({ email: req?.params?.email });
      admin = user?.role === "admin";
      res.status(200).send({ admin });
    });

    // Check seller
    app.get("/seller/:email", verifyToken, async (req, res) => {
      if (req?.user?.email !== req?.params?.email)
        return res.status(403).send({ message: "Forbidden" });
      let seller = false;
      const user = await usersCollection.findOne({ email: req?.params?.email });
      seller = user?.role === "seller";
      res.status(200).send({ seller });
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
