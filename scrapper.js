const axios  = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const fetch = require('node-fetch');
const getopts = require('getopts');
axiosCookieJarSupport(axios);

const {assign} = Object;
const if_set = (val, o, name)=>{
    if (val!==undefined)
        o[name] = val;
};
const wait = ms=>new Promise(resolve=>setTimeout(resolve, ms));
const get_dur = start=>+((Date.now()-start)/1000).toFixed(2)+'s';
const is_array = Array.isArray;

const PARKLON_BASE_URL = 'https://parklon.ru';
const PARKLON_REGIONS_AJAX_URL =
    'https://parklon.ru/local/components/dial/regions/ajax.php';
const PARKLON_ORDER_URL = 'https://parklon.ru/personal/order/make/';
const PARKLON_ADD_TO_BASKET_URL =
    'https://parklon.ru/local/ajax/add_to_basket.php';
const PARKLON_DEL_FROM_BASKET_URL =
    'https://parklon.ru/local/ajax/del_from_basket.php';
const PARKLON_CATALOG_URL = 'https://parklon.ru/catalog/';
const RESTDB_INSTANCES = {
    main: {db: 'parklon-d6c5', api_key: '603fe66aacc40f765fede3a8'},
    db1: {db: 'parklon-f756', api_key: '6043ace5acc40f765fede48c'},
    db2: {db: 'parklon-53e1', api_key: '6043e271acc40f765fede495'},
    db3: {db: 'parklon-9de7', api_key: '6043e371acc40f765fede499'},
    db4: {db: 'parklon-db81', api_key: '6043e3efacc40f765fede49d'},
    db5: {db: 'parklon-d99b', api_key: '6043ea11acc40f765fede4a1'},
    db6: {db: 'parklon-f6fc', api_key: '6043eb0aacc40f765fede4a5'},
    db7: {db: 'parklon-526f', api_key: '6043ebadacc40f765fede4a9'},
    db8: {db: 'parklon-b475', api_key: '6043eddbacc40f765fede4ad'},
    db9: {db: 'parklon-0084', api_key: '6043ef0dacc40f765fede4b1'},
    db10: {db: 'parklon-c974', api_key: '6043ef75acc40f765fede4b5'},
    db11: {db: 'parklon-dd09', api_key: '6044cc2aacc40f765fede4d7'},
    db12: {db: 'parklon-da30', api_key: '6044ccceacc40f765fede4db'},
    db13: {db: 'parklon-359c', api_key: '6044ce16acc40f765fede4df'},
    db14: {db: 'parklon-af08', api_key: '6044d5daacc40f765fede4e3'},
};
const PRODUCT_TYPE_TO_RESTDB_INSTANCE = {
    '138x138 см,1.2 см,PVC': 'db1',
    '190x130 см,1.2 см,PVC': 'db2',
    '190x130 см,3 см,PVC/PU': 'db3',
    '200x140 см,1 см,PE': 'db4',
    '200x140 см,4 см,PVC/PU': 'db5',
    '200x140 см,15 см,PVC/PU': 'db6',
    '200x150 см,1 см,PE': 'db7',
    '200x150 см,1 см,TPU': 'db8',
    '200x180 см,1 см,PE': 'db9',
    '200x180 см,1.5 см,PE': 'db10',
    '210x140 см,1.3 см,PVC/PE': 'db11',
    '230x140 см,1.2 см,PE': 'db12',
    '235x140 см,4 см,PVC/PU': 'db13',
    '250x140 см,1.5 см,PVC': 'db14',
};
const RESTDB_DEBUG = false;
const RESTDB_RETRY = 0;

async function main(){
    const opt = getopts(process.argv.slice(2), {
        alias: {
            type: 't',
            city: 'c',
            save: 's',
            verbose: 'v',
            skip_cities: 'S',
        },
        boolean: ['s', 'v'],
        string: ['t', 'c', 'S'],
    });
    const [cmd, arg1, arg2] = opt._;
    const scrapper = new Scrapper();
    const sync = new Sync(scrapper);
    let db;
    switch (cmd)
    {
    case 'sync_delivery':
    case 'sync_products':
    case 'sync_cities':
        await sync[cmd](opt);
        break;
    case 'get_order_data':
        console.log(await scrapper.get_order_data(arg1));
        break;
    case 'get_routes':
        console.log(await scrapper.get_routes(arg1, arg2, opt));
        break;
    case 'get_cities':
        console.log(await scrapper.get_cities());
        break;
    case 'add_to_basket':
        console.log(await scrapper.add_to_basket(arg1));
        break;
    case 'del_from_basket':
        console.log(await scrapper.del_from_basket(arg1));
        break;
    case 'get_basket_id':
        console.log(await scrapper.get_basket_id(opt));
        break;
    case 'get_product_lines':
        console.log(await scrapper.get_product_lines());
        break;
    case 'get_products':
        console.log(await scrapper.get_products(arg1, arg2));
        break;
    case 'get_conf':
        console.log(await get_conf(arg1));
        break;
    case 'get_all_conf':
        console.log(await get_all_conf());
        break;
    case 'get_total':
        db = PRODUCT_TYPE_TO_RESTDB_INSTANCE[arg1] ? get_restdb_by_type(arg1)
            : restdb(arg1);
        console.log(await db.get_total(arg2));
        break;
    case 'get_live_routes':
        console.log(await get_live_routes(arg1, arg2, opt));
        break;
    }
}

async function get_live_routes(type, city_id, opt){
    const conf = await get_all_conf();
    const type2products = get_products_by_type(conf.products);
    const prod = type2products[type][0].id;
    const scrapper = new Scrapper();
    await scrapper.add_to_basket(prod);
    const {routes} = await scrapper.get_routes(city_id, conf.cities[city_id],
        opt);
    return routes;
}

const get_restdb_by_type = type=>restdb(PRODUCT_TYPE_TO_RESTDB_INSTANCE[type]);

const restdb = name=>{
    if (RESTDB_DEBUG)
        console.log('+ restdb <', name);
    if (!RESTDB_INSTANCES[name])
        throw new Error('no restdb instance '+name);
    this.instances = this.instances||{};
    if (!this.instances[name])
        this.instances[name] = new RestDB(RESTDB_INSTANCES[name]);
    return this.instances[name];
};

async function custom_fetch(url, opt={}){
    const req = {};
    if (opt.method)
        req.method = opt.method;
    if (opt.headers)
        req.headers = opt.headers;
     if (opt.body)
        req.body = opt.body;
    if (opt.input=='form')
    {
        const fd = new FormData();
        if (opt.body)
        {
            for (const k in opt.body)
                fd.append(k, opt.body[k]);
        }
        assign(req, {
            method: 'POST',
            body: fd,
        });
    }
    const res = await fetch(url, req);
    if (opt.output=='json')
        return await res.json();
    return await res.text();
}

async function fetch_json(url, opt){
    return await custom_fetch(url, assign(opt, {output: 'json'}));
}

class RestDB {
    constructor(instance){
        assign(this, instance);
        this.base_url = `https://${this.db}.restdb.io/rest/`;
    }
    async req(path, method, body, level=0){
        if (RESTDB_DEBUG)
        {
            console.log(`+ RestDB[${this.db}].req <`, path, method, body,
                level);
        }
        try {
            return await fetch_json(this.base_url+path, {
                method: method||'GET',
                headers: {
                    'x-apikey': this.api_key,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body,
            });
        } catch(e){
            if (!RESTDB_RETRY || level>=RESTDB_RETRY)
                throw e;
            console.error(e);
            console.log(`retry ${level+1}/${RESTDB_RETRY}`);
            return await this.req(path, method, body, level+1);
        }
    }
    async update(coll, id, data){
        return await this.req(coll+'/'+id, 'PUT', JSON.stringify(data));
    }
    async add(coll, data){
        return await this.req(coll, 'POST', JSON.stringify(data));
    }
    async delete(coll, id){
        return await this.req(coll+'/'+id, 'DELETE');
    }
    async get_all(coll){
        return await this.req(coll);
    }
    async get_one(coll, id){
        return await this.req(coll+'/'+id);
    }
    async query(coll, query){
        return await this.req(coll+'?q='+JSON.stringify(query));
    }
    async get_total(coll){
        const res = await this.req(coll+'?&totals=true&count=true');
        return res.totals.count;
    }
    async update_or_add(coll, query, data){
        const res = await this.query(coll, query);
        if (res && res.length)
            await this.update(coll, res[0]._id, data);
        else
            await this.add(coll, data);
    }
}

class Scrapper {
    constructor(){
        this.jar = new tough.CookieJar();
    }
    async get_order_data(city_name){
        let {data} = await axios.get(PARKLON_ORDER_URL, {
            jar: this.jar,
            withCredentials: true,
        });
        if (city_name && !data.includes(city_name))
            throw new Error(`order city mismatch, expect [${city_name}]`);
        const token_s = 'var JSCustomOrderAjaxArea = new JSCustomOrderAjax(';
        data = data.substr(data.indexOf(token_s)+token_s.length);
        const token_e = 'JSCustomOrderAjaxArea.init()';
        data = data.substr(0, data.indexOf(token_e));
        data = data.trim();
        data = data.substr(0, data.length-2);
        return (new Function('return '+data))();
    }
    async get_routes(city_id, city_name, opt={}){
        if (opt.verbose)
            console.log('+ get_routes <', city_id, city_name, opt);
        const fd = new FormData();
        fd.append('ACTION', 'CHANGE');
        fd.append('ID', city_id);
        await axios.post(PARKLON_REGIONS_AJAX_URL, fd, {
            jar: this.jar,
            withCredentials: true,
            headers: fd.getHeaders(),
        });
        const res = await this.get_order_data(city_name);
        if (opt.verbose)
            console.log('+ get_routes >', res);
        const routes = res.SaleResult.MARSHROUTE;
        let cost_min, cost_max;
        for (const id in routes)
        {
            routes[id] = routes[id].map(r=>{
                const route = {};
                route.cost = +r.cost;
                if (cost_min===undefined || route.cost<cost_min)
                    cost_min = route.cost;
                if (cost_max===undefined || route.cost>cost_max)
                    cost_max = route.cost;
                route.days = +r.days;
                if_set(r.name, route, 'name');
                if_set(r.delivery_code, route, 'code');
                if_set(r.place_id, route, 'place_id');
                if_set(r.gps, route, 'gps');
                if_set(r.phone, route, 'phone');
                if_set(r.address, route, 'address');
                return route;
            });
        }
        return {routes, cost_min, cost_max};
    }
    async get_cities(){
        const fd = new FormData();
        fd.append('ACTION', 'SEARCH');
        const {data} = await axios.post(PARKLON_REGIONS_AJAX_URL, fd, {
            headers: fd.getHeaders()
        });
        const cities = data.searchedresult;
        for (const id in cities)
        {
            if (cities[id]=='Города нет в списке')
                delete cities[id];
        }
        return cities;
    }
    async add_to_basket(id){
        const fd = new FormData();
        fd.append('ACTION', 'PUT');
        fd.append('id', id);
        fd.append('quantity', 1);
        const {data} = await axios.post(PARKLON_ADD_TO_BASKET_URL, fd, {
            jar: this.jar,
            withCredentials: true,
            headers: assign({'bx-ajax': 'true'}, fd.getHeaders()),
        });
        if (!data || data.result!='success')
            throw new Error(`failed add to basket prod [${id}]`);
    }
    async del_from_basket(id){
        const fd = new FormData();
        fd.append('basketAction', 'delete');
        fd.append('id', id);
        const {data} = await axios.post(PARKLON_DEL_FROM_BASKET_URL, fd, {
            jar: this.jar,
            withCredentials: true,
            headers: assign({'bx-ajax': 'true'}, fd.getHeaders()),
        });
        return data;
    }
    async get_basket_id(opt={}){
        if (opt.verbose)
            console.log('+ get_basket_id <', opt);
        const res = await this.get_order_data();
        if (opt.verbose)
            console.log('+ get_basket_id >', res);
        return Object.keys(res && res.SaleResult && res.SaleResult.GRID
            && res.SaleResult.GRID.ROWS || {})[0];
    }
    async get_product_lines(){
        const {data} = await axios.get(PARKLON_CATALOG_URL);
        const $ = cheerio.load(data);
        const lines = [];
        $('#drop-lines-menu a').each(function(i){
            if (!i)
                return;
            const el = $(this);
            const name = el.text();
            const id = name.toLowerCase().replace(/ /g, '_');
            lines.push({id, url: PARKLON_BASE_URL+el.attr('href'), name});
        })
        return lines;
    }
    async get_products(line_id, line_url){
        const {data} = await axios.get(line_url);
        const $ = cheerio.load(data);
        const products = [];
        const get_el_text = el=>el && $(el).text().trim();
        $('.popular-carpets__card').each(function(){
            const el = $(this);
            let id = ''+el.attr('id');
            id = id.match(/(.*)_(.*)_(.*)_/);
            id = id && id[3];
            const a = el.find('a');
            const url = a && PARKLON_BASE_URL+a.attr('href');
            const category = get_el_text(el.find('.popular-carpets__title'));
            const title = get_el_text(el.find('.popular-carpets__sub-title'));
            const price = get_el_text(el.find('.popular-carpets__price'));
            const sizes = [];
            el.find('.popular-carpets__sizes').each(function(){
                const childs = $(this).find('p');
                const name = get_el_text(childs.get(0));
                const value = get_el_text(childs.get(1));
                if (name||value)
                    sizes.push({name, value});
            });
            const imgs = [];
            el.find('.catalog-item__img img').each(function(){
                const o = $(this);
                const src = $(this).attr('src');
                if (src)
                    imgs.push(PARKLON_BASE_URL+src);
            });
            const type = sizes.map(s=>s.value).join(',');
            products.push({id, type, line: line_id, category, title, imgs,
                sizes, price, url});
        });
        return products;
    }
}

async function get_conf(name){
    const res = await restdb('main').query('conf', {name});
    return res && res[0] && res[0].value;
}

async function set_conf(name, value){
    await restdb('main').update_or_add('conf', {name}, {name, value});
}

async function get_all_conf(){
    const res = await restdb('main').get_all('conf');
    const conf = {};
    res.forEach(c=>conf[c.name] = c.value);
    return conf;
}

const get_products_by_type = products=>{
    const res = {};
    products.forEach(p=>{
        res[p.type] = res[p.type]||[];
        res[p.type].push(p);
    });
    return res;
};

const get_products_by_line = products=>{
    const res = {};
    products.forEach(p=>{
        res[p.line] = res[p.line]||[];
        res[p.line].push(p);
    });
    return res;
};

// sync

class Sync {
    constructor(scrapper){
        this.scrapper = scrapper;
    }
    async sync_cities(opt={}){
        const start = Date.now();
        console.log('started sync cities');
        console.log('getting cities...');
        const cities = await this.scrapper.get_cities();
        const cities_len = Object.keys(cities).length;
        console.log(`got [${cities_len}] cities`, cities);
        if (opt.save)
        {
            console.log('saving cities in conf...');
            await set_conf('cities', cities);
            console.log('saved cities in conf');
        }
        console.log('finished sync cities in', get_dur(start));
    }
    async sync_products(opt={}){
        const start = Date.now();
        console.log('started sync products');
        console.log('getting product lines...');
        const lines = await this.scrapper.get_product_lines();
        console.log(`got [${lines.length}] product lines`, lines);
        const products = [], types = [];
        for (const line of lines)
        {
            console.log(`getting products for [${line.id}]...`);
            const _products = await this.scrapper.get_products(line.id,
                line.url);
            _products.forEach(p=>{
                if (!types.includes(p.type))
                    types.push(p.type);
            });
            Array.prototype.push.apply(products, _products);
            console.log(`got [${_products.length}] products for [${line.id}]`,
                _products);
        }
        console.log(`got total [${products.length}] products of`,
            `[${types.length}] types`, products, types);
        if (opt.save)
        {
            console.log('saving products in conf...');
            await set_conf('products', products);
            console.log('saved products in conf');
        }
        console.log('finished sync products', get_dur(start));
    }
    async sync_delivery_for_type(type, opt={}){
        if (opt.verbose)
            console.log('+ sync_delivery_for_type <', type, opt);
        const start = Date.now();
        if (!opt.start)
            assign(opt, {start});
        console.log(`started sync delivery for [${type}]`);
        const {cities, cities_keys} = opt;
        let errors;
        let i = 0;
        const skip_cities = +opt.skip_cities;
        for (const id of cities_keys)
        {
            i++;
            if (skip_cities && i<skip_cities)
                continue;
            const name = cities[id];
            const _start = Date.now();
            try {
                const {routes, cost_min, cost_max} = await this.scrapper
                    .get_routes(id, name, opt);
                const data = {id, type, cost_min, cost_max, routes};
                if (opt.save)
                {
                    await get_restdb_by_type(type).update_or_add('city', {id},
                        data);
                }
                if (!opt.save)
                    console.log(data);
                else if (opt.verbose)
                    console.log('+ sync_delivery_for_type >', data);
                const cost_range = cost_min+'-'+cost_max;
                console.log(`${opt.type_i}/${opt.types_len}`, `[${type}]`,
                    `${i}/${opt.cities_len}`,`[${id}]`, name, cost_range+'₽',
                    'OK', get_dur(_start), get_dur(opt.start));
            } catch(e){
                console.log(`${opt.type_i}/${opt.types_len}`, `[${type}]`,
                    `${i}/${opt.cities_len}`, `[${id}]`, name, cost_range+'₽',
                    'ERROR', e, get_dur(_start), get_dur(opt.start));
                errors = errors||{};
                errors[id] = e;
            }
            if (opt.wait)
                await wait(opt.wait);
        }
        console.log(`finished sync delivery for type [${type}] in`,
            get_dur(start));
        return {errors};
    }
    async sync_delivery(opt={}){
        const start = Date.now();
        if (!opt.start)
            assign(opt, {start});
        console.log('started sync delivery');
        const {cities, products} = await get_all_conf();
        if (!products)
            throw new Error('no products');
        if (!cities)
            throw new Error('no cities');
        const type2products = get_products_by_type(products);
        const types = Object.keys(type2products).filter(t=>{
            return !opt.type || opt.type==t
                || is_array(opt.type) && opt.type.includes(t);
        });
        types.forEach(type=>{
            if (!PRODUCT_TYPE_TO_RESTDB_INSTANCE[type])
                throw new Error(`no db instance for [${type}]`);
        });
        const types_len = types.length;
        if (!types_len)
            throw new Error('empty types');
        const cities_keys = Object.keys(cities).filter(k=>{
            return !opt.city || opt.city==k
                || is_array(opt.city) && opt.city.includes(k);
        });
        const cities_len = cities_keys.length;
        if (!cities_len)
            throw new Error('empty cities');
        assign(opt, {cities, cities_keys, cities_len, types_len});
        const errors = {};
        let i = 0;
        for (const type of types)
        {
            i++;
            console.log(`process type [${type}] ${i}/${types_len}`);
            const prod = type2products[type][0].id;
            console.log(`adding product [${prod}] to basket...`);
            await this.scrapper.add_to_basket(prod);
            console.log('product added');
            console.log('getting basket ID...');
            const basket_id = await this.scrapper.get_basket_id(opt);
            if (!basket_id)
                throw new Error(`failed get basket ID prod [${prod}]`);
            console.log(`got basket ID [${basket_id}]`);
            const res = await this.sync_delivery_for_type(type,
                assign(opt, {type_i: i}));
            if (res.errors)
                errors[id] = res.errors;
            console.log(`deleting from basket [${basket_id}]...`);
            await this.scrapper.del_from_basket(basket_id);
            console.log('basket is empty');
        }
        if (Object.keys(errors).length)
            console.log('errors', errors);
        console.log('finished sync delivery in', get_dur(start));
    }
}

if (!module.parent)
    main();
