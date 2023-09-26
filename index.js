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

const createQueryOperators = (name, platform) => {
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

    return queryOps;
};

app.post("/api/games/search", (req, res) => {
    const { name, platform } = req.body;

    if (!name && !platform) {
        getAllGames(res);
    } else {
        let queryOps = createQueryOperators(name, platform);

        //Sequelize support match over indexes only on PG
        db.Game.findAll({
            where: {
                [Op.and]: queryOps,
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

const createNewAppsArrayFromJson = async (url) => {
    try {
        const settings = { method: "Get" };
        const res = await fetch(url, settings);
        const apps = await res.json();
        const flattenApps = apps.flat(3);

        let new_apps = [];

        flattenApps.forEach((app) => {
            // only add apps that have a rank, being the sorting criteria
            if (app.rank) {
                new_apps.push({
                    rank: app.rank,
                    publisherId: app.publisher_id,
                    name: app.name,
                    platform: app.os,
                    // storeId: ???, // not sure of the mapping for storeId, so omitting by now
                    bundleId: app.bundle_id,
                    appVersion: app.version,
                    isPublished: true, // not sure of the mapping for isPublished, defaulting to true
                });
            }
        });
        return new_apps;
    } catch (err) {
        return err;
    }
};

app.post("/api/games/populate", async (req, res) => {
    Promise.all([
        createNewAppsArrayFromJson(urlIOs),
        createNewAppsArrayFromJson(urlAndroid),
    ]).then((apps) => {
        const new_apps = apps.flat();

        // Not sure if the spec meant 200 apps (top 100 apps for each platform), I'm assuming the top 100 in total combined for both platforms
        const top_apps = new_apps.sort((app1, app2) =>
            app1.rank < app2.rank ? 1 : app1.rank > app2.rank ? -1 : 0
        );

        const top_100_apps = top_apps.slice(0, 100).map((top_app) => {
            const { rank, ...rest } = top_app;
            return rest;
        });

        return db.Game.bulkCreate(top_100_apps)
            .then((new_top_apps) => {
                const ids = new_top_apps.map((nt_app) => {
                    return nt_app.id;
                });
                return res.send(ids);
            })
            .catch((err) => {
                console.log(
                    "***There was an error populating the db with app",
                    JSON.stringify(err)
                );
                return res.status(400).send(err);
            });
    });
});

app.listen(3000, () => {
    console.log("Server is up on port 3000");
});

module.exports = app;
