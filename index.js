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
    const bookingsCollection = db.collection("bookings");
    const postsCollection = db.collection("posts");

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

    // fetch api for admin to get all the classes for update status
    app.get("/api/classes", async (req, res) => {
      const classes = await classesCollection.find().toArray();
      res.send(classes);
    });

    // fetch approved classes
    app.get("/api/approved-classes", async (req, res) => {
      try {
        const { status } = req.query;

        const filter = {};

        if (status) {
          filter.status = status;
        }

        const result = await classesCollection.find(filter).toArray();

        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching classes:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch classes",
        });
      }
    });

    // fetch approved class by id || details
    app.get("/api/approved-class/:classId", async (req, res) => {
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

        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching class:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch class",
          error: error.message,
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

    // api for update class data by user || admin
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
          status: modifiedClass.status,
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

    //  bookings
    app.patch("/api/bookings/:classId", async (req, res) => {
      const { classId } = req.params;
      const bookings = req.body;

      const classes = await classesCollection.findOne({
        _id: new ObjectId(classId),
      });

      if (!classes) {
        res.status(404).json({ message: "Class not Found!" });
      }

      await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        {
          $inc: { bookingCount: 1 },
          $set: {
            lastBookingAt: new Date(),
          },
        },
      );

      const result = await bookingsCollection.insertOne({
        ...bookings,
        bookingAt: new Date(),
      });

      res.send(result);
    });

    // add forum post
    app.post("/api/post", async (req, res) => {
      try {
        const postData = {
          ...req.body,
          createdAt: new Date(),
        };

        const result = await postsCollection.insertOne(postData);

        // res.status(200).json(result);

        res.status(201).json({
          success: true,
          message: "post added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding post:", error);

        res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    // get forum post
    app.get("/api/posts", async (req, res) => {
      try {
        const result = await postsCollection.find().toArray();
        res.status(200).json(result);
      } catch (e) {
        console.error("Can't fetch posts", e);
        res.status(500).json({
          success: false,
          message: "Fetching Failed!",
        });
      }
    });

    // get api for fetching all classes by specific user;
    app.get("/api/posts/:authorId", async (req, res) => {
      try {
        const { authorId } = req.params;
        const posts = await postsCollection
          .find({ authorId: authorId })
          .toArray();
        res.status(200).json(posts);
      } catch (e) {
        console.error("Error fetching Posts data", e);
        res.status(500).json({
          message: "Failed to fetch Posts. Please try again later.",
        });
      }
    });

    // like api
    app.post("/api/posts/:postId/like", async (req, res) => {
      try {
        const { postId } = req.params;
        const { userId } = req.body;

        const post = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        if (!post) {
          return res.status(404).json({
            message: "Post not found",
          });
        }

        let likes = post.likes || [];
        let dislikes = post.dislikes || [];

        const alreadyLiked = likes.includes(userId);

        if (alreadyLiked) {
          likes = likes.filter((id) => id !== userId);
        } else {
          likes.push(userId);
          dislikes = dislikes.filter((id) => id !== userId);
        }

        await postsCollection.updateOne(
          { _id: new ObjectId(postId) },
          {
            $set: {
              likes,
              dislikes,
            },
          },
        );

        const updatedPost = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        res.send(updatedPost);
      } catch (error) {
        res.status(500).send({
          message: "Failed to like post",
        });
      }
    });

    // dislike api
    app.post("/api/posts/:postId/dislike", async (req, res) => {
      try {
        const { postId } = req.params;
        const { userId } = req.body;

        const post = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        let likes = post.likes || [];
        let dislikes = post.dislikes || [];

        const alreadyDisliked = dislikes.includes(userId);

        if (alreadyDisliked) {
          dislikes = dislikes.filter((id) => id !== userId);
        } else {
          dislikes.push(userId);
          likes = likes.filter((id) => id !== userId);
        }

        await postsCollection.updateOne(
          { _id: new ObjectId(postId) },
          {
            $set: {
              likes,
              dislikes,
            },
          },
        );

        const updatedPost = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        res.send(updatedPost);
      } catch (error) {
        res.status(500).send({
          message: "Failed to dislike post",
        });
      }
    });

    //comment api

    app.post("/api/posts/:postId/comments", async (req, res) => {
      try {
        const { postId } = req.params;

        const { userId, userName, text, parentCommentId = null } = req.body;

        const comment = {
          _id: new ObjectId().toString(),
          userId,
          userName,
          text,
          parentCommentId,
          createdAt: new Date(),
        };

        await postsCollection.updateOne(
          { _id: new ObjectId(postId) },
          {
            $push: {
              comments: comment,
            },
          },
        );

        const updatedPost = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        res.send(updatedPost.comments);
      } catch (error) {
        res.status(500).send({
          message: "Failed to add comment",
        });
      }
    });

    // edit comment
    app.put("/api/posts/:postId/comments/:commentId", async (req, res) => {
      try {
        const { postId, commentId } = req.params;
        const { text, userId } = req.body;

        const post = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        const comments = post.comments.map((comment) => {
          if (comment._id === commentId && comment.userId === userId) {
            return {
              ...comment,
              text,
              updatedAt: new Date(),
            };
          }
          return comment;
        });

        await postsCollection.updateOne(
          { _id: new ObjectId(postId) },
          {
            $set: { comments },
          },
        );

        res.send(comments);
      } catch (error) {
        res.status(500).send({
          message: "Failed to update comment",
        });
      }
    });

    // delet comment api
    app.delete("/api/posts/:postId/comments/:commentId", async (req, res) => {
      try {
        const { postId, commentId } = req.params;
        const { userId } = req.body;

        const post = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        const comments = post.comments.filter(
          (comment) =>
            !(comment._id === commentId && comment.userId === userId),
        );

        await postsCollection.updateOne(
          { _id: new ObjectId(postId) },
          {
            $set: {
              comments,
            },
          },
        );

        res.send(comments);
      } catch (error) {
        res.status(500).send({
          message: "Failed to delete comment",
        });
      }
    });

    // post details api
    app.get("/api/post/:postId", async (req, res) => {
      try {
        const { postId } = req.params;

        if (!ObjectId.isValid(postId)) {
          return res.status(400).send({
            message: "Invalid post ID",
          });
        }

        const result = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        if (!result) {
          return res.status(404).send({
            message: "Post not found",
          });
        }

        res.status(200).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({
          message: "Failed to fetch post",
        });
      }
    });

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
