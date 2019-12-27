const mongoose = require("mongoose");
const Event = require("../models/event.model.js");

// Create and Save a new event
exports.create = (req, res) => {
  const event = new Event(...req.body);

  // Save event in the database
  event
    .save()
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while creating the event."
      });
    });
};

// Retrieve and return all events from the database.
exports.findAll = (req, res) => {
  const {
    pageNo,
    itemsPerPage,
    searchText,
    relatedSkills,
    city,
    country
  } = req.query;
  let pageNumber = pageNo ? parseInt(pageNo) : 1;
  let nPerPage = itemsPerPage ? parseInt(itemsPerPage) : 200;

  let skillsQuery = {};
  let textQuery = {};
  let andQuery = [];

  if (searchText) {
    textQuery["$or"] = [
      { name: { $regex: searchText, $options: "i" } },
      { description: { $regex: searchText, $options: "i" } }
    ];
    andQuery.push(textQuery);
  }

  if (relatedSkills) {
    let skills = relatedSkills.split(",");
    if (skills.length) {
      skillsQuery["$or"] = [{ relatedSkills: { $in: skills } }];
      andQuery.push(skillsQuery);
    }
  }

  let cityQuery = [];
  if (city || country) {
    if (city) {
      cityQuery.push({ city: { $regex: city, $options: "i" } });
    }
    if (country) {
      cityQuery.push({ country: country });
    }
    let locationQuery = {
      $or: cityQuery
    };
    andQuery.push(locationQuery);
  }

  let finalQuery = {};
  if (andQuery.length) {
    finalQuery = { $and: andQuery };
  }

  Event.find(finalQuery)
    .sort({ createdAt: "descending" })
    .skip((pageNumber - 1) * nPerPage)
    .limit(nPerPage)
    .then(events => {
      res.send(events);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving events."
      });
    });
};

// Retrieve and return all events with given IDs.
exports.withIds = (req, res) => {
  const ids = req.query.ids.split(",").map(id => mongoose.Types.ObjectId(id));
  Event.find({ _id: { $in: ids } })
    .then(events => {
      res.send(events);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving events."
      });
    });
};

// Retrieve and return all events from the given city.
exports.findAllInCity = (req, res) => {
  const cityName = req.params.cityName;
  const countryCode = req.params.countryCode;
  Event.find({ city: cityName, country: countryCode })
    .then(events => {
      res.send(events);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving events."
      });
    });
};

// Retrieve and return all events from the database.
exports.findAllUpcoming = (req, res) => {
  Event.find({ dateFrom: { $gte: new Date() } })
    .then(events => {
      res.send(events);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving events."
      });
    });
};

// Find a single event with a id
exports.findOne = (req, res) => {
  Event.findById(req.params.id)
    .then(event => {
      if (!event) {
        return res.status(404).send({
          message: "event not found with id " + req.params.id
        });
      }
      res.send(event);
    })
    .catch(err => {
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "event not found with id " + req.params.id
        });
      }
      return res.status(500).send({
        message: "Error retrieving event with id " + req.params.id
      });
    });
};

// Update a event identified by the id in the request
exports.update = (req, res) => {
  Event.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body
    },
    { new: true }
  )
    .then(event => {
      if (!event) {
        return res.status(404).send({
          message: "event not found with id " + req.params.id
        });
      }
      res.send(event);
    })
    .catch(err => {
      if (err.kind === "ObjectId") {
        return res.status(404).send({
          message: "event not found with id " + req.params.id
        });
      }
      return res.status(500).send({
        message: "Error updating event with id " + req.params.id
      });
    });
};

// Delete a event with the specified id in the request
exports.delete = (req, res) => {
  Event.findByIdAndRemove(req.params.id)
    .then(event => {
      if (!event) {
        return res.status(404).send({
          message: "event not found with id " + req.params.id
        });
      }
      res.send({ message: "event deleted successfully!" });
    })
    .catch(err => {
      if (err.kind === "ObjectId" || err.name === "NotFound") {
        return res.status(404).send({
          message: "event not found with id " + req.params.id
        });
      }
      return res.status(500).send({
        message: "Could not delete event with id " + req.params.id
      });
    });
};
