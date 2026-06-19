const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());
dotenv.config();

const uri = process.env.MONGODB_URI;
const DBName = process.env.DB_NAME;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //db collection
    const db = client.db(DBName);
    const classesCollection = db.collection("classes");
    const usersCollection = db.collection("user");

    // post api for adding new class;
    app.post("/api/classes", async (req, res) => {
      try {
        const classData = {
          ...req.body,
          createdAt: new Date(),
        };

        const result = await classesCollection.insertOne(classData);

        res.status(200).json({
          success: true,
          data: result,
        });

        res.status(201).json({
          success: true,
          message: "class added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding class:", error);

        res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    // get api for fetching all classes by specific user;
    app.get("/api/classes/:trainnerId", async (req, res) => {
      try {
        const { trainnerId } = req.params;
        const classes = await classesCollection
          .find({ trainnerId: trainnerId })
          .toArray();
        res.status(200).json(classes);
      } catch (e) {
        console.error("Error fetching classes data", e);
        res.status(500).json({
          message: "Failed to fetch classes. Please try again later.",
        });
      }
    });

    // api for update class data by user
    app.patch("/api/classes/:classId", async (req, res) => {
      const { classId } = req.params;
      const filter = {
        _id: new ObjectId(classId),
      };
      const modifiedClass = req.body;
      const updatedData = {
        $set: {
          className: modifiedClass.className,
          category: modifiedClass.category,
          difficultyLevel: modifiedClass.difficultyLevel,
          duration: modifiedClass.duration,
          price: modifiedClass.price,
          description: modifiedClass.description,
        },
      };
      const result = await classesCollection.updateOne(filter, updatedData);

      res.send(result);
    });

    // delete class from trainner
    app.delete("/api/classes/:classId", async (req, res) => {
      const { classId } = req.params;
      const result = await classesCollection.deleteOne({
        _id: new ObjectId(classId),
      });
      res.json(result);
    });

    // fetch class by id
    app.get("/api/classes/:classId", async (req, res) => {
      try {
        const { classId } = req.params;

        if (!ObjectId.isValid(classId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid class ID",
          });
        }

        const query = { _id: new ObjectId(classId) };
        const result = await classesCollection.findOne(query);

        if (!result) {
          return res.status(404).json({
            success: false,
            message: "class not found",
          });
        }

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error("Error fetching class:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch class",
          error: error.message,
        });
      }
    });

    // app.patch("/api/producst", async (req, res) => {
    //   try {
    //   } catch (e) {
    //     console.error("Failed to update this product", e);
    //   }
    // });

    // get users data
    app.get("/api/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.status(200).json(users);
      } catch (e) {
        console.error("Error Fetching Users Data", e);
        res.status(500).json({
          message: "Failed to Fetched users data. Please try again later",
        });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
