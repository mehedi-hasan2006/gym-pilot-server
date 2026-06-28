const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());
dotenv.config();

const uri = process.env.MONGODB_URI;
const DBName = process.env.DB_NAME;

// verify token midleware
const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized. Verification Failed!!.." });
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

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
    const applicationsCollection = db.collection("applications");
    const favoritesCollection = db.collection("favorites");
    const paymentsCollection = db.collection("payments");

    await bookingsCollection.createIndex(
      { userId: 1, classId: 1 },
      { unique: true },
    );

    // get booking by admin
    app.get("/api/bookings/class/:classId", async (req, res) => {
      try {
        const { classId } = req.params;

        const bookings = await bookingsCollection
          .find({
            classId,
            isBooked: true, // শুধুমাত্র successful payment/booked
          })
          .sort({ bookingAt: -1 })
          .toArray();

        res.status(200).json({
          success: true,
          total: bookings.length,
          data: bookings,
        });
      } catch (error) {
        console.error("Get Class Bookings Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch booked users",
        });
      }
    });

    // get booking from user
    app.get("/api/bookings/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const bookings = await bookingsCollection
          .aggregate([
            {
              $match: {
                userId,
              },
            },
            {
              $lookup: {
                from: "classes",
                let: {
                  classId: "$classId",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: [
                          "$_id",
                          {
                            $toObjectId: "$$classId",
                          },
                        ],
                      },
                    },
                  },
                ],
                as: "classInfo",
              },
            },
            {
              $unwind: "$classInfo",
            },
            {
              $project: {
                userId: 1,
                classId: 1,
                bookingAt: 1,
                isBooked: 1,
                paymentStatus: 1,

                className: "$classInfo.className",
                image: "$classInfo.image",
                category: "$classInfo.category",
                difficultyLevel: "$classInfo.difficultyLevel",
                duration: "$classInfo.duration",
                price: "$classInfo.price",
                trainerName: "$classInfo.trainnerName",
                schedules: "$classInfo.schedules",
              },
            },
            {
              $sort: {
                bookingAt: -1,
              },
            },
          ])
          .toArray();

        res.status(200).json({
          success: true,
          total: bookings.length,
          data: bookings,
        });
      } catch (error) {
        console.error("Get User Bookings Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch booking information",
        });
      }
    });

    //  bookings
    app.patch("/api/bookings/:classId", async (req, res) => {
      try {
        const { classId } = req.params;
        const bookingData = req.body;

        // Check class exists
        const existingClass = await classesCollection.findOne({
          _id: new ObjectId(classId),
        });

        if (!existingClass) {
          return res.status(404).json({
            success: false,
            message: "Class not found",
          });
        }

        // Check duplicate booking
        const existingBooking = await bookingsCollection.findOne({
          userId: bookingData.userId,
          classId,
          isBooked: true,
        });

        if (existingBooking) {
          return res.status(409).json({
            success: false,
            message: "You have already booked this class.",
          });
        }

        res.status(201).json({
          success: true,
        });
      } catch (error) {
        console.error(error);

        if (error.code === 11000) {
          return res.status(409).json({
            success: false,
            message: "You have already booked this class.",
          });
        }

        res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    // Check booking status
    app.get("/api/bookings/check", async (req, res) => {
      try {
        const { userId, classId } = req.query;

        if (!userId || !classId) {
          return res.status(400).json({
            success: false,
            message: "userId and classId are required",
          });
        }

        const booking = await bookingsCollection.findOne({
          userId,
          classId,
          isBooked: true,
        });

        return res.status(200).json({
          success: true,
          isBooked: !!booking,
          booking: booking || null,
        });
      } catch (error) {
        console.error("Booking Check Error:", error);

        res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    // payments
    app.post("/api/payments", async (req, res) => {
      try {
        const paymentData = {
          ...req.body,
          paymentAt: new Date(),
        };

        const existingPayment = await paymentsCollection.findOne({
          sessionId: paymentData.sessionId,
        });

        if (existingPayment) {
          return res.status(409).json({
            success: false,
            message: "Payment already completed",
          });
        }

        // Save payment
        const paymentResult = await paymentsCollection.insertOne(paymentData);

        // Update booking
        const bookingResult = await bookingsCollection.insertOne({
          userId: paymentData.userId,
          classId: paymentData.classId,
          userName: paymentData.name,
          email: paymentData.email,
          isBooked: true,
          paymentStatus: "Paid",
          paidAt: new Date(),
          bookingAt: new Date(),
          paymentId: paymentResult.insertedId,
        });

        // Booking update successful  booking count ++
        if (bookingResult.insertedId) {
          await classesCollection.updateOne(
            {
              _id: new ObjectId(paymentData.classId),
            },
            {
              $inc: {
                bookingCount: 1,
              },
              $set: {
                lastBookingAt: new Date(),
              },
            },
          );
        }

        res.status(201).json({
          success: true,
          message: "Payment completed successfully",
          insertedId: paymentResult.insertedId,
        });
      } catch (error) {
        console.error("Payment Error:", error);

        res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    // get payments
    app.get("/api/payments", async (req, res) => {
      try {
        const result = await paymentsCollection.find().toArray();
        res.status(200).json(result);
      } catch (e) {
        console.error("Can't fetch payments", e);
        res.status(500).json({
          success: false,
          message: "Fetching Failed!",
        });
      }
    });

    // trainner stats
    app.get("/api/trainers/stats/:trainerId", async (req, res) => {
      try {
        const { trainerId } = req.params;

        const stats = await classesCollection
          .aggregate([
            {
              $match: {
                trainnerId: trainerId,
              },
            },
            {
              $group: {
                _id: null,
                totalClasses: { $sum: 1 },
                totalStudents: {
                  $sum: {
                    $ifNull: ["$bookingCount", 0],
                  },
                },
              },
            },
          ])
          .toArray();

        res.status(200).json({
          success: true,
          data: stats[0] || {
            totalClasses: 0,
            totalStudents: 0,
          },
        });
      } catch (error) {
        console.error("Trainer Stats Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch trainer statistics",
        });
      }
    });

    // Get Admin Dashboard Stats
    app.get("/api/admin/stats", async (req, res) => {
      try {
        const [
          totalUsers,
          totalClasses,
          totalBookedClasses,
          pendingApplications,
          forumPosts,
          transactions,
        ] = await Promise.all([
          // Total Users
          usersCollection.countDocuments(),

          // Total Classes
          classesCollection.countDocuments(),

          // Total Successful Bookings
          bookingsCollection.countDocuments({
            isBooked: true,
          }),

          // Pending Trainer Applications
          applicationsCollection.countDocuments({
            status: "Pending",
          }),

          // Total Forum Posts
          postsCollection.countDocuments(),

          // Total Transactions (Successful Payments)
          paymentsCollection.countDocuments(),
        ]);

        res.status(200).json({
          success: true,
          data: {
            totalUsers,
            totalClasses,
            totalBookedClasses,
            pendingApplications,
            forumPosts,
            transactions,
          },
        });
      } catch (error) {
        console.error("Admin Dashboard Stats Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch dashboard statistics",
        });
      }
    });

    // create  applications
    app.post("/api/applications", async (req, res) => {
      try {
        const {
          userId,
          name,
          email,
          experience,
          specialty,
          certification,
          bio,
          availability,
        } = req.body;

        if (!userId) {
          return res.status(400).json({
            success: false,
            message: "User ID is required",
          });
        }

        // Check existing application
        const existingApplication = await applicationsCollection.findOne({
          userId,
        });

        if (existingApplication) {
          return res.status(409).json({
            success: false,
            message: "You have already submitted an application",
          });
        }

        const applicationData = {
          userId,
          name,
          email,
          experience,
          specialty,
          certification,
          bio,
          availability,
          status: "Pending",
          createdAt: new Date(),
        };

        const result = await applicationsCollection.insertOne(applicationData);

        res.status(201).json({
          success: true,
          message: "Application submitted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Trainer Application Error:", error);

        if (error.code === 11000) {
          return res.status(409).json({
            success: false,
            message: "You have already submitted an application",
          });
        }

        res.status(500).json({
          success: false,
          message: "Failed to submit application",
        });
      }
    });

    // get all applications by admin
    app.get("/api/applications", async (req, res) => {
      try {
        const result = await applicationsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Failed to fetch applications",
        });
      }
    });

    // get application by specific user
    app.get("/api/application/:userId", async (req, res) => {
      const { userId } = req.params;

      const application = await applicationsCollection.findOne({ userId });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      res.status(200).json({
        success: true,
        data: application,
      });
    });

    // Approve & Reject Application API
    app.patch("/api/applications/:id", async (req, res) => {
      try {
        const { id } = req.params;

        // Find application first
        const application = await applicationsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!application) {
          return res.status(404).json({
            success: false,
            message: "Application not found",
          });
        }

        const updateData = {
          ...req.body,
          reviewedAt: new Date(),
        };

        // Update application
        await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: updateData,
          },
        );

        // Update user role only if Approved
        if (updateData.status === "Approved") {
          await usersCollection.updateOne(
            {
              _id: new ObjectId(application.userId),
            },
            {
              $set: {
                role: "trainner",
                updatedAt: new Date(),
              },
            },
          );
        }

        res.status(200).json({
          success: true,
          message: `Application ${updateData.status.toLowerCase()} successfully`,
        });
      } catch (error) {
        console.error("Update Application Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to update application",
        });
      }
    });

    // applications stats
    app.get("/api/applications/stats", async (req, res) => {
      try {
        const totalApplications = await applicationsCollection.countDocuments();

        const approvedApplications =
          await applicationsCollection.countDocuments({
            status: "Approved",
          });

        const rejectedApplications =
          await applicationsCollection.countDocuments({
            status: "Rejected",
          });

        const pendingApplications = await applicationsCollection.countDocuments(
          {
            status: "Pending",
          },
        );

        res.status(200).json({
          success: true,
          data: {
            total: totalApplications,
            approved: approvedApplications,
            rejected: rejectedApplications,
            pending: pendingApplications,
          },
        });
      } catch (error) {
        console.error("Application Stats Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch application stats",
        });
      }
    });

    //Delete Application API
    app.delete("/api/applications/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await applicationsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Application not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Application deleted successfully",
        });
      } catch (error) {
        console.error("Delete Application Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to delete application",
        });
      }
    });

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

    // Get Featured Classes
    app.get("/api/classes/featured", async (req, res) => {
      try {
        const featuredClasses = await classesCollection
          .find({
            status: "Approved",
          })
          .sort({
            bookingCount: -1,
          })
          .limit(6)
          .project({
            className: 1,
            image: 1,
            trainnerName: 1,
            category: 1,
            price: 1,
            duration: 1,
            bookingCount: 1,
            difficultyLevel: 1,
          })
          .toArray();

        res.status(200).json({
          success: true,
          total: featuredClasses.length,
          data: featuredClasses,
        });
      } catch (error) {
        console.error("Featured Classes Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch featured classes",
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

    // Toggle Favorite API
    app.patch("/api/favorites/:classId", async (req, res) => {
      try {
        const { classId } = req.params;
        const { userId } = req.body;

        const existingFavorite = await favoritesCollection.findOne({
          userId,
          classId,
        });

        if (existingFavorite) {
          const deleteResult = await favoritesCollection.deleteOne({
            _id: existingFavorite._id,
          });

          return res.json({
            success: true,
            isFavorite: false,
          });
        }

        const insertResult = await favoritesCollection.insertOne({
          userId,
          classId,
          createdAt: new Date(),
        });

        return res.json({
          success: true,
          isFavorite: true,
        });
      } catch (error) {
        console.error("Favorite Error:", error);
      }
    });

    //Get Favorite Classes
    app.get("/api/favorites/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const favorites = await favoritesCollection.find({ userId }).toArray();

        const classIds = favorites.map((favorite) => favorite.classId);

        const objectIds = classIds.map((id) => new ObjectId(id));

        const favoriteClasses = await classesCollection
          .find({
            _id: {
              $in: objectIds,
            },
          })
          .toArray();

        console.log("favoriteClasses:", favoriteClasses);
        const oneClass = await classesCollection.findOne();

        res.status(200).json({
          success: true,
          data: favoriteClasses,
        });
      } catch (error) {
        console.error("Get Favorites Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch favorites",
        });
      }
    });

    //Check Single Favorite
    app.get("/api/favorites/check/:classId/:userId", async (req, res) => {
      try {
        const { classId, userId } = req.params;

        const favorite = await favoritesCollection.findOne({
          userId,
          classId,
        });

        res.status(200).json({
          success: true,
          isFavorite: !!favorite,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Failed to check favorite",
        });
      }
    });

    // get bookings
    app.get("/api/bookings", async (req, res) => {
      try {
        const result = await bookingsCollection.find({}).toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send(error);
      }
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

    // Get Recent Forum Posts
    app.get("/api/posts/recent", async (req, res) => {
      try {
        const recentPosts = await postsCollection
          .find({
            status: "active",
          })
          .sort({
            createdAt: -1,
          })
          .limit(4)
          .project({
            title: 1,
            description: 1,
            userName: 1,
            userImage: 1,
            createdAt: 1,
            likes: 1,
            comments: 1,
          })
          .toArray();

        res.status(200).json({
          success: true,
          total: recentPosts.length,
          data: recentPosts,
        });
      } catch (error) {
        console.error("Recent Posts Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch recent posts",
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

    // Delete Forum Post
    app.delete("/api/posts/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await postsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.status(200).json({
          success: true,
          message: "Post deleted successfully",
          result,
        });
      } catch (e) {
        console.error("Can't delete post", e);
        res.status(500).json({
          success: false,
          message: "Delete Failed!",
        });
      }
    });

    //Get Forum Stats
    app.get("/api/posts/stats", async (req, res) => {
      try {
        const posts = await postsCollection.find().toArray();

        const totalPosts = posts.length;

        const totalLikes = posts.reduce(
          (sum, post) => sum + (post.likes?.length || 0),
          0,
        );

        const totalComments = posts.reduce(
          (sum, post) => sum + (post.comments?.length || 0),
          0,
        );

        const reportedPosts = posts.filter(
          (post) => post.reported === true,
        ).length;

        res.status(200).json({
          success: true,
          totalPosts,
          totalLikes,
          totalComments,
          reportedPosts,
        });
      } catch (e) {
        console.error("Can't fetch stats", e);
        res.status(500).json({
          success: false,
          message: "Fetching Stats Failed!",
        });
      }
    });

    //Report Post
    app.patch("/api/posts/report/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const reportData = req.body;

        const result = await postsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              reported: true,
            },
            $push: {
              reports: {
                ...reportData,
                reportedAt: new Date(),
              },
            },
          },
        );

        res.status(200).json({
          success: true,
          message: "Post reported successfully",
          result,
        });
      } catch (e) {
        console.error("Can't report post", e);
        res.status(500).json({
          success: false,
          message: "Report Failed!",
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

    //Update User Status
    // example: Active / Inactive / Blocked
    app.patch("/api/users/status/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status,
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "User status updated successfully",
        });
      } catch (error) {
        console.error("Update User Status Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to update user status",
        });
      }
    });

    //Update User Role
    // example: member → trainer → admin
    app.patch("/api/users/role/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role,
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "User role updated successfully",
        });
      } catch (error) {
        console.error("Update User Role Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to update user role",
        });
      }
    });

    // Delete user
    app.delete("/api/users/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "User deleted successfully",
        });
      } catch (error) {
        console.error("Delete User Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to delete user",
        });
      }
    });

    // Get User Stats
    app.get("/api/users/stats", async (req, res) => {
      try {
        const stats = await usersCollection
          .aggregate([
            {
              $group: {
                _id: null,
                total: { $sum: 1 },

                admins: {
                  $sum: {
                    $cond: [{ $eq: ["$role", "admin"] }, 1, 0],
                  },
                },

                trainners: {
                  $sum: {
                    $cond: [{ $eq: ["$role", "trainner"] }, 1, 0],
                  },
                },

                members: {
                  $sum: {
                    $cond: [{ $eq: ["$role", "member"] }, 1, 0],
                  },
                },

                active: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "Active"] }, 1, 0],
                  },
                },
                blocked: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "Blocked"] }, 1, 0],
                  },
                },
              },
            },
          ])
          .toArray();

        const result = stats[0] || {
          total: 0,
          admins: 0,
          trainners: 0,
          members: 0,
          active: 0,
          blocked: 0,
        };

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error("User Stats Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch user statistics",
        });
      }
    });

    //Get All Trainers
    app.get("/api/trainners", async (req, res) => {
      try {
        const trainners = await usersCollection
          .find({ role: "trainner" })
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json({
          success: true,
          data: trainners,
        });
      } catch (error) {
        console.error("Get Trainers Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch trainers",
        });
      }
    });

    //Demote Trainer To User
    app.patch("/api/trainners/demote/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "member",
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Trainer not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Trainer demoted successfully",
        });
      } catch (error) {
        console.error("Demote Trainer Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to demote trainer",
        });
      }
    });

    // Update Trainer Status======= Active / Inactive / Blocked
    app.patch("/api/trainners/status/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await usersCollection.updateOne(
          {
            _id: new ObjectId(id),
            role: "trainner",
          },
          {
            $set: {
              status,
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Trainer not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Trainer status updated successfully",
        });
      } catch (error) {
        console.error("Update Trainer Status Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to update trainer status",
        });
      }
    });

    // Get Trainer Stats
    app.get("/api/trainners/stats", async (req, res) => {
      try {
        const stats = await usersCollection
          .aggregate([
            {
              $match: {
                role: "trainner",
              },
            },
            {
              $group: {
                _id: null,

                total: { $sum: 1 },

                active: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "Active"] }, 1, 0],
                  },
                },

                blocked: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "Blocked"] }, 1, 0],
                  },
                },

                inactive: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "Inactive"] }, 1, 0],
                  },
                },
              },
            },
          ])
          .toArray();

        const result = stats[0] || {
          total: 0,
          active: 0,
          blocked: 0,
          inactive: 0,
        };

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error("Trainer Stats Error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch trainer stats",
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
