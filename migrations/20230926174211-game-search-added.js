"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        queryInterface.addIndex("Games", ["name", "platform"]);
    },

    async down(queryInterface, Sequelize) {
        return queryInterface.removeIndex("Games", ["name", "platform"]);
    },
};
