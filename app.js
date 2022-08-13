require("dotenv").config();
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var passport = require("passport");
var cookieParser = require("cookie-parser");
var LocalStrategy = require("passport-local");
var methodOverride = require("method-override");
var flash = require("connect-flash");
var async = require("async");
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
var ejs = require("ejs");
let pdf = require("html-pdf");
let path = require("path");
const fetch = require("node-fetch");

const crypto = require("crypto");
const Razorpay = require("razorpay");
const cors = require("cors");

//-------------STRIPE SETUP--------------------------------

// const multer = require("multer");
// const { storage } = require("cloudinary");
// const upload = multer({ storage });

// //-------------------MODELS-------------------------
var User = require("./models/user");
var Comment = require("./models/comment");
var Blog = require("./models/blog");
var Match = require("./models/Match");

// //-------------------NODEMAILER-------------------------

// const nodemailer = require("nodemailer");
// var transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     // user: process.env.email,
//     // pass: process.env.pwd,
//   },
// });

// function send(mailOptions) {
//   transporter.sendMail(mailOptions, function (error, info) {
//     if (error) {
//       console.log(error);
//     } else {
//       console.log("Email sent: " + info.response);
//     }
//   });
// }

//----------------------OTHERS & AUTH ----------------------
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(cookieParser("secret"));
app.use(flash());
app.use(cors());
app.locals.moment = require("moment");
// seedDB();

app.use(
  require("express-session")({
    secret: "Shhhh Secret!",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});
//-------------MONGOOSE----------------------------

var db = process.env.MONGO_URL.toString();
mongoose
  .connect(db, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  })
  .then(() => console.log("Connected to DB!"))
  .catch((error) => console.log(error.message));

//-----------------Razorpay-------------------------------------

const instance = new Razorpay({
  key_id: process.env.KEY_ID,
  key_secret: process.env.KEY_SECRET,
});

//---------------------------------------------------------------------
//-----------------------------ROUTES ---------------------------------

//------------------------------NAVBAR---------------------------------------

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/donate", function (req, res) {
  res.render("donate", { key: process.env.KEY_ID });
});

// app.get("/scholarships", function (req, res) {
//   res.render("scholarships");
// });

app.get("/profile", isLoggedIn, function (req, res) {
  Blog.find({ authorid: req.user._id }, function (err, allposts) {
    if (err) {
      console.log(err);
    } else {
      res.render("profile", { stories: allposts });
    }
  }).sort({ date: "desc" });
});

//RazorPay---------------------------------------------------------------
app.get("/payments", (req, res) => {
  res.render("payment", { key: process.env.KEY_ID });
});
app.post("/api/payment/order", (req, res) => {
  params = req.body;
  instance.orders
    .create(params)
    .then((data) => {
      res.send({ sub: data, status: "success" });
    })
    .catch((error) => {
      res.send({ sub: error, status: "failed" });
    });
});

app.post("/api/payment/verify", (req, res) => {
  body = req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id;

  var expectedSignature = crypto.createHmac("sha256", process.env.KEY_SECRET).update(body.toString()).digest("hex");
  console.log("sig" + req.body.razorpay_signature);
  console.log("sig" + expectedSignature);
  var response = { status: "failure" };
  if (expectedSignature === req.body.razorpay_signature) response = { status: "success" };
  res.send(response);
});

app.get("/razorpay");

// ----------------- DONATE --------------------------

app.post("/donate", async function (req, res) {
  ejs.renderFile(path.join(__dirname, "./views/", "certificate.ejs"), { name: req.body.name, amount: req.body.amount }, (err, data) => {
    if (err) {
      console.log(err);
      res.send({ error: err });
    } else {
      let options = {
        header: {
          height: "20mm",
        },
        footer: {
          height: "20mm",
        },
        format: "A2",
      };

      pdf.create(data, options).toFile("certificate.pdf", function (err, data) {
        if (err) {
          console.log(err);
          res.send({ error: err });
        } else {
          console.log("CERTIFICATE");
          var mailOptions = {
            from: "AID",
            to: req.body.email,
            subject: "Certificate for Donating to Aid",
            attachments: { filename: "certificate.pdf", path: "./certificate.pdf" },
            html: `<h1>Hello ${req.body.name} ! </h1>
            <h2>Thank you for your generous Donation of Rs. ${req.body.amount} to Aid.</h2>
            <h4> Your smallest contribution could change someone's life ! </h4>
            <div> Stay assured, your money will be used for a good cause. </div>
            <div>We have sent you a Certificate as an attachement with this email as a token of appreciation from our side.</div>
          <br>
           <div>We hope you won't stop here and will further support the good causes of Humanity.</div>
            <div>Happy Charity ! </div> <div> Because even the smallest contribution matters. </div><br> <small>Best Regards ,</small><b> AID.</b> `,
          };
          send(mailOptions);
        }
      });
    }
  });
  res.render("submitD", { name: req.body.name, email: req.body.email });
});

//BLOG-------------------------------------------------------------------------

app.get("/forum", function (req, res) {
  Blog.find({}, function (err, allposts) {
    if (err) {
      console.log(err);
    } else {
      res.render("blogs", { blogs: allposts });
    }
  }).sort({ date: "desc" });
});

app.get("/newblog", isLoggedIn, function (req, res) {
  res.render("newblog");
});

app.post("/newblog/:id", isLoggedIn, function (req, res) {
  var blog = new Blog({
    title: req.body.title,
    body: req.body.body,
    authorname: req.user.name,
  });

  User.findById(req.params.id, function (err, founduser) {
    if (err) {
      req.flash("error", "Something went wrong!");
      res.redirect("back");
    } else {
      founduser.blogs.push(blog);
      founduser.save();
    }
  });
  Blog.create(blog, function (err, newblog) {
    if (err) {
      console.log(err);
    } else {
      req.flash("success", "Added your blog successfully!");
      return res.redirect("/forum");
    }
  });
});

app.post("/forum/:blogid/comment", isLoggedIn, function (req, res) {
  var comment = new Comment({
    body: req.body.comment,
    authorname: req.user.name,
    authorid: req.user._id,
  });
  Blog.findById(req.params.blogid, function (err, foundBlog) {
    if (err) {
      console.log(err);
    } else {
      foundBlog.comments.push(comment);
      foundBlog.save();
    }
  });
  res.redirect("/forum");
});

//DashBoard--------------------------------------------------------------------
app.get("/mentordashboard", isLoggedIn, async function (req, res) {
  mymentees = [];
  Match.find({ mentor: req.user._id }, async function (err, mts) {
    if (err) {
      console.log(err);
    } else {
      for (var i = 0; i < mts.length; i++) {
        await User.findById(mts[i].mentee, async function (err, ment) {
          if (err) console.log(err);
          else {
            mymentees.push(ment);
          }
        });
      }
      res.render("mentordashboard", { mentees: mymentees });
    }
  });
  console.log(mymentees);
});
app.get("/menteedashboard", isLoggedIn, function (req, res) {
  Match.find({ mentee: req.user._id }, async function (err, mts) {
    if (err) {
      console.log(err);
    } else {
      console.log(mts);
      console.log(mts["mentor"]);
      // console.log(mts[0].mentor);
      User.findById(mts[0]["mentor"], function (err, mntr) {
        if (err) console.log(err);
        else {
          console.log(mntr);
          res.render("menteedashboard", { mentor: mntr });
        }
      });
    }
  });
});

//-----------------------------AUTH--------------------------------------

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/signup/mentee", function (req, res) {
  res.render("signupmentee");
});
// app.get("/blogs", function (req, res) {
//     res.render("blogs");
// });
app.get("/signup/mentor", function (req, res) {
  res.render("signupmentor");
});

app.post("/login", function (req, res, next) {
  passport.authenticate(
    "local",
    {
      successRedirect: "/",
      failureRedirect: "/login",
      failureFlash: true,
      succssFlash: true,
    },
    function (err, user) {
      if (err) {
        return next(err);
      }
      if (!user) {
        req.flash("error", "Password or Email does not match");
        return res.redirect("/login");
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        req.flash("success", "Welcome back " + user.name);
        return res.redirect("/");
      });
    }
  )(req, res, next);
});

app.post("/signup", function (req, res) {
  console.log(req.body);
  var newUser = new User({
    username: req.body.username,
    name: req.body.name,
    phone: req.body.phone,
    type: req.body.type,
    lang1: req.body.lang1,
    lang2: req.body.lang2,
    lang3: req.body.lang3,
    gender: req.body.gender,
    state: req.body.state,
    district: req.body.district,
    city: req.body.city,
    parentsnumber: req.body.parentsnumber,
    mentorgender: req.body.mentorgender,
    school: req.body.school,
    year: req.body.year,
    grade: req.body.grade,
    threshold: req.body.limit,

    programming: req.body.programming,
    electronics: req.body.electronics,
    medicalscience: req.body.medicalscience,
    humanities: req.body.humanities,
    commerce: req.body.commerce,
    entrepreneurship: req.body.entrepreneurship,
    blogging: req.body.blogging,
    contentwriting: req.body.contentwriting,
    socialwork: req.body.socialwork,
    artandpainting: req.body.artandpainting,
    performancearts: req.body.performancearts,
    cookingandbaking: req.body.cookingandbaking,
    architecture: req.body.architecture,
    interiordesign: req.body.interiordesign,
    digitalgraphics: req.body.digitalgraphics,
    teaching: req.body.teaching,
    law: req.body.law,
    accounting: req.body.accounting,
    sports: req.body.sports,
    photography: req.body.photography,
  });

  User.register(newUser, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      if (err.message == "A user with the given username is already registered") {
        req.flash("error", "A user with the given Email Id is already registered");
        return res.redirect("/signin");
      } else {
        req.flash("error", "A user with the given Phone No. is already registered");
        return res.redirect("/signin");
      }
    } else {
      passport.authenticate("local")(req, res, function () {
        req.flash("success", "Welcome to *LetsConnect* " + user.name);
        // if (user.type === "mentor") res.redirect("/mentordashboard");
        // else res.redirect("/menteedashboard");
        res.redirect("/");
      });
    }
  });
});

app.get("/logout", function (req, res) {
  req.logout();
  req.flash("success", "Logged you out!");
  res.redirect("/");
});

//ml-------------------------------------------------------------------
app.get("/match", async function (req, res) {
  User.find({}, async function (err, allUsers) {
    if (err) {
      console.log(err);
      return res.redirect("back");
    } else {
      const requestBody = { users: allUsers };
      console.log("request1");
      console.log(requestBody);
      console.log("request2");
      console.log("request3");
      const response = await fetch("http://localhost:8000/ml", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      //const data = { 123: ["123", "456"], abc: [123, 456] };
      matches = [];
      for (var mentor in data) {
        for (var i = 0; i < data[mentor].length; i++) {
          const newmatch = new Match({
            mentor: mentor,
            mentee: data[mentor][i],
          });
          Match.create(newmatch, async function (err, newmatch) {
            if (err) {
              console.log(err);
            } else await matches.push(newmatch);
            //console.log(newmatch);
          });
        }
      }
      console.log(matches);
      return res.render("admin", { users: allUsers, matches: matches });
    }
  });
});

//--------------------------ADMIN----------------------------------

app.get("/admin", function (req, res) {
  User.find({}, function (err, allUsers) {
    if (err) console.log(err);
    else res.render("admin", { users: allUsers, matches: [] });
  });
});

//----------------------END OF ROUTES --------------------------------------

app.get("*", function (req, res) {
  res.render("404");
});

//===================== MIDDLEWARE =================//
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash("error", "You need to be logged in to do that.");
    res.redirect("/login");
  }
}

const PORT = 5000;
//--------------------------------RUN -----------------------------------
app.listen(PORT, function (req, res) {
  console.log("rollin");
});
