/*jshint esversion: 8*/
import axios from 'axios';
import {load} from 'cheerio';
import FormData from 'form-data';
import {CookieJar} from 'tough-cookie';
import fetch from 'node-fetch';
import {HttpsCookieAgent} from 'http-cookie-agent/http';
import {get_fetch, BaseScrapper, RestDB, BaseRestDBInstance, Conf, Sync} from './api.js';

const {fetch_json} = get_fetch(fetch);

class Scrapper extends BaseScrapper {
    constructor(){
        super();
        const jar = new CookieJar();
        this.client = axios.create({
            // headers: {'Accept-Encoding': 'application/json'},
            withCredentials: true,
            httpsAgent: new HttpsCookieAgent({cookies: {jar}, rejectUnauthorized: false}),
        });
    }
    async dummy(){
        const response = await axios.get('https://google.com',
            {headers: {'Accept-Encoding': 'application/json'}});
        console.log(response);
    }
    async get(url, opt={}){
        if (opt.verbose)
            console.log('GET', url);
        const {data} = await this.client.get(url);
        return data;
    }
    async post(url, body, headers, opt={}){
        const fd = new FormData();
        for (const k in body)
            fd.append(k, body[k]);
        if (opt.verbose)
            console.log('POST', url, body);
        const res = await this.client.post(url, fd, Object.assign({
            headers: Object.assign(fd.getHeaders(), headers),
        }));
        return res.data;
    }
    parse(data){
        const $ = load(data);
        return {$, parsed: $};
    }
    select($, selector){
        return $(selector);
    }
}

const init = ()=>{
    const restdb = new RestDB(class extends BaseRestDBInstance {
        async fetch_json(url, opt){
            return fetch_json(url, opt);
        }
    });
    const config = new Conf(restdb);
    const scrapper = new Scrapper();
    const sync = new Sync(scrapper, restdb);
    return {restdb, config, scrapper, sync};
};

export default {Scrapper, init};