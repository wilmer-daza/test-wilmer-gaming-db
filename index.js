const express = require("express");
const bodyParser = require("body-parser");
const db = require("./models");
const { Op } = require("sequelize");
const fetch = require("node-fetch");

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

const getAllGames = (res) => {
    db.Game.findAll()
        .then((games) => res.send(games))
        .catch((err) => {
            console.log(
                "There was an error querying games",
                JSON.stringify(err)
            );
            return res.send(err);
        });
};

app.get("/api/games", (req, res) => {
    getAllGames(res);
});

app.post("/api/games", (req, res) => {
    const {
        publisherId,
        name,
        platform,
        storeId,
        bundleId,
        appVersion,
        isPublished,
    } = req.body;
    return db.Game.create({
        publisherId,
        name,
        platform,
        storeId,
        bundleId,
        appVersion,
        isPublished,
    })
        .then((game) => res.send(game))
        .catch((err) => {
            console.log(
                "***There was an error creating a game",
                JSON.stringify(err)
            );
            return res.status(400).send(err);
        });
});

app.delete("/api/games/:id", (req, res) => {
    // eslint-disable-next-line radix
    const id = parseInt(req.params.id);
    return db.Game.findByPk(id)
        .then((game) => game.destroy({ force: true }))
        .then(() => res.send({ id }))
        .catch((err) => {
            console.log("***Error deleting game", JSON.stringify(err));
            res.status(400).send(err);
        });
});

app.put("/api/games/:id", (req, res) => {
    // eslint-disable-next-line radix
    const id = parseInt(req.params.id);
    return db.Game.findByPk(id).then((game) => {
        const {
            publisherId,
            name,
            platform,
            storeId,
            bundleId,
            appVersion,
            isPublished,
        } = req.body;
        return game
            .update({
                publisherId,
                name,
                platform,
                storeId,
                bundleId,
                appVersion,
                isPublished,
            })
            .then(() => res.send(game))
            .catch((err) => {
                console.log("***Error updating game", JSON.stringify(err));
                res.status(400).send(err);
            });
    });
});

app.post("/api/games/search", (req, res) => {
    const { name, platform } = req.body;

    if (!name && !platform) {
        getAllGames(res);
    } else {
        let queryOps = [];

        if (name) {
            queryOps.push({
                name: {
                    [Op.like]: `%${name}%`,
                },
            });
        }

        if (platform) {
            queryOps.push({
                platform: {
                    [Op.like]: `%${platform}%`,
                },
            });
        }

        //Sequelize support match over indexes only on PG
        db.Game.findAll({
            where: {
                [Op.or]: queryOps,
            },
        })
            .then((games) => res.send(games))
            .catch((err) => {
                console.log(
                    "There was an error in searching games",
                    JSON.stringify(err)
                );
                return res.send(err);
            });
    }
});

const urlAndroid =
    "https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/android.top100.json";

const urlIOs =
    "https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/ios.top100.json";

const getJsonAppFromURL = (url) => {
    let settings = { method: "Get" };

    fetch(url, settings)
        .then((res) => res.json())
        .then((json) => {
            return json;
        });
};

const createNewAppsArray = (apps) => {
    let new_apps = [];
    const flattenApps = apps.flat(3);

    flattenApps.forEach((app) => {
        new_apps.push({
            publisherId: app.publisher_id,
            name: app.name,
            platform: app.os,
            // storeId: ???, //TODO: not sure of the mapping of storeId, so omitting by now
            bundleId: app.bundle_id,
            appVersion: app.version,
            isPublished: true,
        });
    });
    return new_apps;
};

app.post("/api/games/populate", (req, res) => {
    const ios_apps = createNewAppsArray(getJsonAppFromURL(urlIOs));
    const android_apps = createNewAppsArray(getJsonAppFromURL(urlAndroid));

    const new_apps = [...ios_apps, ...android_apps];

    return db.Game.bulkCreate(new_apps)
        .then((game) => res.send(game))
        .catch((err) => {
            console.log(
                "***There was an error populating the db with app",
                JSON.stringify(err)
            );
            return res.status(400).send(err);
        });
});

app.listen(3000, () => {
    console.log("Server is up on port 3000");
});

module.exports = app;
