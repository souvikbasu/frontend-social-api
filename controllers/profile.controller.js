const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const cityController = require("./city.controller");
const rewardPointsController = require("./reward-points.controller.js");
const Freelance = require("../models/freelancing.model.js");

const { JWT_SECRET } = process.env;

const REFERRAL_REWARD_POINTS = 100;

// Create and Save a new user
exports.findSocialAuthUserinDB = async (
  provider,
  user,
  req,
  res,
  authResponse
) => {
  let name, profilePic, email, admin;

  if (provider === "facebook") {
    name = user.name;
    profilePic = user.picture.data.url;
    email = user.email;
    admin = user.admin || false;
  } else if (provider === "github") {
    name = user.name || user.login;
    profilePic = user.avatar_url;
    email = user.email;
    admin = user.admin || false;
  } else if (provider === "twitter") {
    name = user.name;
    profilePic = user.profile_image_url_https;
    email = null;
    admin = user.admin || false;
  } else if (provider === "google") {
    name = user.name;
    profilePic = user.picture;
    email = user.email;
    admin = user.admin || false;
  }

  if (email) {
    User.find({ email: email })
      .then((existingUser) => {
        if (existingUser == null || !existingUser.length) {
          //user not found. Create one
          return createSocialAuthUser(
            name,
            profilePic,
            email,
            admin,
            provider,
            user.id,
            req,
            res,
            authResponse
          );
        }

        const authToken = jwt.sign(
          {
            email,
            username: existingUser[0].username,
            admin: existingUser[0].admin || admin,
          },
          JWT_SECRET
        );
        const account = { ...authResponse, authToken, ...existingUser[0]._doc };
        res.send(account);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send({
          message: "Error retrieving user with " + provider + " id " + user.id,
        });
      });
  } else {
    User.find({ socialId: user.id, provider: provider })
      .then((existingUser) => {
        if (existingUser == null || !existingUser.length) {
          //user not found. Create one
          return createSocialAuthUser(
            name,
            profilePic,
            email,
            admin,
            provider,
            user.id,
            req,
            res,
            authResponse
          );
        }

        const authToken = jwt.sign(
          {
            email,
            username: existingUser[0].username,
            admin: existingUser[0].admin || admin,
          },
          JWT_SECRET
        );
        const account = { ...authResponse, authToken, ...existingUser[0]._doc };
        res.send(account);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send({
          message: "Error retrieving user with " + provider + " id " + user.id,
        });
      });
  }
};

async function createUniqueUsername(name) {
  let alreadyExists = true;
  let username = "";
  let counter = 0;
  while (alreadyExists) {
    username =
      name.replace(" ", "").toLowerCase() +
      (counter === 0 ? "" : counter.toString());
    let existingUser = await User.findOne({ username: username });
    alreadyExists = existingUser != null;
    counter++;
  }
  return username;
}

async function createSocialAuthUser(
  name,
  profilePic,
  email,
  admin,
  provider,
  socialId,
  req,
  res,
  authResponse
) {
  const username = await createUniqueUsername(name);
  const authToken = jwt.sign({ email, username, admin }, JWT_SECRET);

  const user = new User({
    name,
    username,
    category: "dev",
    profilePic,
    email,
    social: [
      { label: "Github", value: "" },
      { label: "Twitter", value: "" },
      { label: "LinkedIn", value: "" },
      { label: "Bitbucket", value: "" },
      { label: "Medium", value: "" },
      { label: "Website", value: "" },
      { label: "Stack Overflow", value: "" },
    ],
    skills: [
      { name: "JS", noOfYears: 0, rating: 0 },
      { name: "HTML5", noOfYears: 0, rating: 0 },
      { name: "CSS", noOfYears: 0, rating: 0 },
      { name: "React", noOfYears: 0, rating: 0 },
      { name: "Angular", noOfYears: 0, rating: 0 },
      { name: "Vue", noOfYears: 0, rating: 0 },
      { name: "Web Components", noOfYears: 0, rating: 0 },
      { name: "Website Design", noOfYears: 0, rating: 0 },
      { name: "Android", noOfYears: 0, rating: 0 },
      { name: "iOS", noOfYears: 0, rating: 0 },
    ],
    eventIds: [],
    socialId,
    provider,
    city: null,
    country: null,
  });

  // Save user in the database
  try {
    const userModel = await user.save();
    const account = { ...authResponse, authToken, ...userModel._doc };

    updateReferral(req.query.referrer, user.username);
    res.send(account);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the user.",
    });
  }
}

async function updateReferral(referrer, username) {
  // Save referral in the database
  try {
    if (referrer != "null") {
      var referral = { username: username, createdAt: new Date() };
      await User.updateOne(
        { username: referrer },
        {
          $push: { referrals: referral },
        }
      );
      console.log(referrer);
      setRewardPointsForReferral(referrer, username);
      return true;
    }
    return false;
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the user.",
    });
  }
}

async function setRewardPointsForReferral(referrer, username) {
  rewardPointsController.addRewardPoints(
    referrer,
    REFERRAL_REWARD_POINTS,
    `Credited for ${username}'s Referral`
  );
}

// Retrieve and return all users from the database.
exports.findAll = (req, res) => {
  const searchText = req.query.searchText;
  const userId = req.query.userId;
  let textQuery = {};
  if (searchText) {
    textQuery["$or"] = [
      { name: { $regex: searchText, $options: "i" } },
      { username: { $regex: searchText, $options: "i" } },
    ];
  } else if (userId) {
    textQuery = { _id: userId };
  }
  User.find(textQuery)
    .then((users) => {
      res.send(users);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving users.",
      });
    });
};

// Find a single user with a id
exports.findOne = (req, res) => {
  User.findById(req.params.id)
    .then((user) => {
      if (!user) {
        return res.status(404).send({
          message: "user not found with id " + req.params.id,
        });
      }
      res.send(user);
    })
    .catch((err) => {
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "user not found with id " + req.params.id,
        });
      }
      return res.status(500).send({
        message: "Error retrieving user with id " + req.params.id,
      });
    });
};

exports.me = (req, res) => {
  const username = req.user.username;
  User.findOne({ username: username })
    .then((user) => {
      if (!user) {
        return res.status(404).send({
          message: "user not found with username " + username,
        });
      }
      res.send(user);
    })
    .catch((err) => {
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "user not found with username " + username,
        });
      }
      return res.status(500).send({
        message: "Error retrieving user with username " + username,
      });
    });
};

// Update user of logged in user
exports.update = async (req, res) => {
  const username = req.user.username;

  try {
    const existingUser = await User.findOne({ username: username });

    if (!existingUser) {
      return res.status(404).send({
        message: "user not found with email " + username,
      });
    }
    const userId = existingUser.id;

    if (req.user.username !== req.body.username) {
      const userWithNewUsername = await User.findOne({
        username: req.body.username,
      });
      if (userWithNewUsername != null && userWithNewUsername.id != userId) {
        return res.status(500).send({
          message:
            "user with username " + req.body.username + " already exists",
        });
      }
    }

    //create city for the user
    await cityController.createCityIfNotExists({
      name: req.body.city,
      country: req.body.country,
    });

    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          ...req.body,
        },
        { new: true }
      );
      let skill = [];
      skill = updatedUser.skills.map((skill) => skill.name);
      Freelance.findOne({ username: req.body.username }).then((user) => {
        Freelance.updateOne(
          { username: user.username },
          {
            name: updatedUser.name,
            city: updatedUser.city,
            country: updatedUser.country,
            relatedSkills: skill,
            category: updatedUser.category,
          }
        ).then(() => {});
      });

      if (!updatedUser) {
        return res.status(404).send({
          message: "user not found with id " + userId,
        });
      }

      res.send(updatedUser);
    } catch (err) {
      console.log(err);
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "user not found with id " + userId,
        });
      }
      return res.status(500).send({
        message: "Error updating user with id " + userId,
      });
    }
  } catch (err) {
    console.log(err);
    if (err.kind === "ObjectId") {
      return res.status(404).send({
        message: "user not found with email " + username,
      });
    }
    return res.status(500).send({
      message: "Error retrieving user with email " + username,
    });
  }
};

// Delete a user for logged in user
exports.delete = (req, res) => {
  const email = req.user.email;

  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        return res.status(404).send({
          message: "user not found with email " + email,
        });
      }
      const userId = user.id;

      User.findByIdAndRemove(userId)
        .then((user) => {
          if (!user) {
            return res.status(404).send({
              message: "user not found with id " + userId,
            });
          }
          res.send({ message: "user deleted successfully!" });
        })
        .catch((err) => {
          if (err.kind === "ObjectId" || err.name === "NotFound") {
            return res.status(404).send({
              message: "user not found with id " + userId,
            });
          }
          return res.status(500).send({
            message: "Could not delete user with id " + userId,
          });
        });
    })
    .catch((err) => {
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "user not found with email " + email,
        });
      }
      return res.status(500).send({
        message: "Error retrieving user with email " + email,
      });
    });
};

exports.findByUsername = (req, res) => {
  const username = req.params.username;
  User.findOne({ username: username })
    .then((user) => {
      if (!user) {
        return res.status(404).send({
          message: "user not found with username " + username,
        });
      }
      res.send(user);
    })
    .catch((err) => {
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "user not found with username " + username,
        });
      }
      return res.status(500).send({
        message: "Error retrieving user with username " + username,
      });
    });
};

exports.findUsersInCity = (req, res) => {
  const cityName = req.params.cityName;
  const countryCode = req.params.countryCode;
  User.find({ city: cityName, country: countryCode })
    .then((users) => {
      res.send(users);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while saving users.",
      });
    });
};

exports.analytics = (req, res) => {
  if (req.user.admin) {
    const createdAt = req.params.createdAt;
    User.find({
      createdAt: {
        $gte: `${createdAt} 00:00:00.000Z`,
        $lt: `${createdAt} 23:59:59.999Z`,
      },
    })
      .then((user) => {
        if (!user) {
          return res.status(404).send({
            message: "user not found with createdAt " + createdAt,
          });
        }
        res.send(user);
      })
      .catch((err) => {
        if (err.kind === "ObjectId") {
          return res.status(404).send({
            message: "user not found with createdAt " + createdAt,
          });
        }
        return res.status(500).send({
          message: "Error retrieving user with username " + username,
        });
      });
  } else {
    return res.status(403).send({
      message: "Error retrieving user with username " + req.user.username,
    });
  }
};

// Update user preferences of logged in user
exports.updatePreferences = async (req, res) => {
  User.update(
    { username: req.user.username },
    { $set: { userPreferences: req.body.userPreferences } }
  )
    .then((users) => {
      User.findOne({ username: req.user.username }).then((user) => {
        res.send(user);
      });
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while saving user preferences.",
      });
    });
};

// Update user referrals of logged in user
exports.getAllReferrals = async (req, res) => {
  User.findOne({ username: req.user.username })
    .then((user) => {
      var users = [];

      if (user.referrals.length > 0) {
        user.referrals.forEach(async (element) => {
          result = await User.findOne(
            { username: element.username },
            { _id: 0, name: 1, username: 1, profilePic: 1 }
          );
          users.push(result);

          if (users.length === user.referrals.length) {
            res.send(users);
          }
        });
      } else {
        //if no referrals
        res.send(users);
      }
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while getting user referrals.",
      });
    });
};

exports.updateProfilePic = (req, res) => {
  User.findByIdAndUpdate(
    req.body.userId,
    {
      profilePic: req.body.imageUrl,
    },
    { new: true }
  )
    .then((profilePic) => {
      if (!profilePic) {
        return res.status(404).send({
          message: "profile not found with id " + req.body.userId,
        });
      }
      res.send(profilePic);
    })
    .catch((err) => {
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "profile not found with id " + req.body.userId,
        });
      }
      return res.status(500).send({
        message: "Error updating profilePic with id " + req.body.userId,
      });
    });
};
