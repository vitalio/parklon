/*jshint esversion: 8*/
require = require('esm')(module);
const api = require('./api.js');
const api_node = require('./api_node.js');
const express = require('express');
const cors = require('cors');
const PORT = process.env.PORT||80;

let conf, type2products;

async function init(){
    const {config} = api_node.init();
    conf = await config.get_all();
    type2products = api.get_products_by_type(conf.products);
    const app = express();
    app.use(cors());
    app.get('/live_routes', get_live_routes);
    app.listen(PORT, ()=>console.log(`Listening on ${PORT}`));
}

async function get_live_routes(req, res){
    const start = Date.now();
    const {type, city_id} = req.query;
    console.log(`get_live_routes`, req.query);
    const prod = type2products[type][0].id;
    const scrapper = new api_node.Scrapper();
    await scrapper.add_to_basket(prod);
    const result = await scrapper.get_routes(city_id, conf.cities[city_id]);
    res.json(Object.assign(result, {dur: Date.now()-start}));
}

init();