const RESTDB_API_KEY = '603fe66aacc40f765fede3a8';
const RESTDB_BASE_URL = 'https://parklon-d6c5.restdb.io/rest/';
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
};
const LINE_TO_RESTDB_INSTANCE = {
    portable: 'main',
    prime_living: 'db1',
};
const RESTDB_DEBUG = false;

// util

const {assign} = Object;
const wait = ms=>new Promise(resolve=>setTimeout(resolve, ms));
const get_el_text = el=>el && el.textContent && el.textContent.trim();
const init_parse_html = html=>{
    const parse_range = document.createRange();
    return parse = Range.prototype.createContextualFragment.bind(parse_range);
};
const parse_html = init_parse_html();
const if_set = (val, o, name)=>{
    if (val!==undefined)
        o[name] = val;
};
const get_dur = start=>+((Date.now()-start)/1000).toFixed(2)+'s';
const is_array = Array.isArray;

// fetch

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

// restdb

function get_restdb_by_line(line){
    return restdb(LINE_TO_RESTDB_INSTANCE[line]);
}

function restdb(name){
    if (RESTDB_DEBUG)
        console.log('+ restdb <', name);
    if (!RESTDB_INSTANCES[name])
        throw new Error('no restdb instance '+name);
    this.instances = this.instances||{};
    if (!this.instances[name])
        this.instances[name] = new RestDB(RESTDB_INSTANCES[name]);
    return this.instances[name];
}

class RestDB {
    constructor(instance){
        assign(this, instance);
    }
    async req(path, method, body){
        if (RESTDB_DEBUG)
            console.log(`+ RestDB[${this.db}].req <`, path, method, body);
        return await fetch_json(`https://${this.db}.restdb.io/rest/${path}`, {
            method: method||'GET',
            headers: {
                'x-apikey': this.api_key,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body,
        });
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
    async update_or_add(coll, query, data){
        const res = await this.query(coll, query);
        if (res && res.length)
            await this.update(coll, res[0]._id, data);
        else
            await this.add(coll, data);
    }
}

// conf

async function get_conf(name){
    const res = await restdb('main').query('conf', {name});
    return res && res[0] && res[0].value;
}

async function set_conf(name, value){
    await restdb('main').update_or_add('conf', {name}, {name, value});
}

// order

async function get_order_data(city_name){
    let html = await custom_fetch(PARKLON_ORDER_URL);
    if (city_name && !html.includes(city_name))
        throw new Error('');
    const start_token = 'var JSCustomOrderAjaxArea = new JSCustomOrderAjax(';
    html = html.substr(html.indexOf(start_token)+start_token.length);
    const end_token = 'JSCustomOrderAjaxArea.init()';
    html = html.substr(0, html.indexOf(end_token));
    html = html.trim();
    html = html.substr(0, html.length-2);
    return (new Function('return '+html))();
}

async function get_delivery_routes(city_id, city_name, opt={}){
    if (opt.verbose)
        console.log('+ get_delivery_routes <', city_id, city_name, opt);
    await fetch_json(PARKLON_REGIONS_AJAX_URL, {
        input: 'form', body: {ACTION: 'CHANGE', ID: ''+city_id}});
    const res = await get_order_data(city_name);
    if (opt.verbose)
        console.log('+ get_delivery_routes >', res);
    const routes = res.SaleResult.MARSHROUTE;
    for (const id in routes)
    {
        routes[id] = routes[id].map(r=>{
            const route = {};
            route.cost = +r.cost;
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
    return routes;
}

// cities

async function get_cities(){
    const res = await fetch_json(PARKLON_REGIONS_AJAX_URL,
        {input: 'form', body: {ACTION: 'SEARCH'}});
    const cities = res && res.searchedresult;
    for (const id in cities)
    {
        if (cities[id]=='Города нет в списке')
            delete cities[id];
    }
    return cities;
}

// basket

async function add_to_basket(id){
    return await fetch_json(PARKLON_ADD_TO_BASKET_URL, {
        input: 'form', body: {ACTION: 'PUT', id, quantity: 1},
        headers: {'bx-ajax': 'true'},
    });
}

async function del_from_basket(id){
    return await custom_fetch(PARKLON_DEL_FROM_BASKET_URL, {
        input: 'form', body: {basketAction: 'delete', id},
        headers: {'bx-ajax': 'true'},
    });
}

async function get_basket_id(opt={}){
    if (opt.verbose)
        console.log('+ get_basket_id <', opt);
    const res = await get_order_data();
    if (opt.verbose)
        console.log('+ get_basket_id >', res);
    return Object.keys(res && res.SaleResult && res.SaleResult.GRID
        && res.SaleResult.GRID.ROWS || {})[0];
}

// product

async function get_product_lines(){
    const doc = parse_html(await custom_fetch(PARKLON_CATALOG_URL));
    const links = doc.querySelectorAll('#drop-lines-menu a');
    const lines = [];
    for (let i=1; i<links.length; i++)
    {
        const name = links[i].textContent;
        const id = name.toLowerCase().replace(/ /g, '_');
        lines.push({id, url: links[i].href, name});
    }
    return lines;
}

async function get_products(line){
    const doc = parse_html(await custom_fetch(line.url));
    const products = [];
    for(const prod of doc.querySelectorAll('.popular-carpets__card')||[])
    {
        let id = ''+prod.id;
        id = id.match(/(.*)_(.*)_(.*)_/);
        id = id && id[3];
        const a = prod.querySelector('a');
        const url = a && a.href;
        const category = get_el_text(
            prod.querySelector('.popular-carpets__title'));
        const title = get_el_text(
            prod.querySelector('.popular-carpets__sub-title'));
        const price = get_el_text(
            prod.querySelector('.popular-carpets__price'));
        const sizes = [];
        for (const o of prod.querySelectorAll('.popular-carpets__sizes')||[])
        {
            const childs = o.children||[];
            const name = get_el_text(childs[0]);
            const value = get_el_text(childs[1]);
            if (name||value)
                sizes.push({name, value});
        }
        const imgs = [];
        for (const img of prod.querySelectorAll('.catalog-item__img img')||[])
        {
            if (img && img.src)
                imgs.push(img.src);
        }
        products.push({id, category, title, imgs, sizes, price, url});
    }
    return products;
}

// sync

async function sync_cities(){
    const start = Date.now();
    console.log('started sync cities');
    console.log('getting cities...');
    const cities = await get_cities();
    const cities_len = Object.keys(cities).length;
    console.log(`got [${cities_len}] cities`, cities);
    console.log('saving cities in conf...');
    await set_conf('cities', cities);
    console.log('saved cities in conf');
    console.log('finished sync cities in', get_dur(start));
}

async function sync_catalog(){
    const start = Date.now();
    console.log('started sync catalog');
    console.log('loading product lines...');
    const lines = await get_product_lines();
    console.log(`got [${lines.length}] product lines`, lines);
    const catalog = {};
    for (const line of lines)
    {
        const products = await get_products(line);
        console.log(`line [${line.id}] has ${products.length} products`,
            products);
        if (products.length)
            catalog[line.id] = assign({}, line, {products});
    }
    console.log(`saving catalog [${Object.keys(catalog).length}] to conf...`,
        catalog);
    await set_conf('catalog', catalog);
    console.log('catalog saved');
    console.log('finished sync catalog in', get_dur(start));
}

async function sync_delivery_for_line_and_city(line, city, opt={}){
    if (opt.verbose)
        console.log('+ sync_delivery_for_line_and_city <', line, city, opt);
    const start = Date.now();
    if (!opt.start)
        assign(opt, {start});
    try {
        const routes = await get_delivery_routes(city.id, city.name, opt);
        const data = {id: city.id, line: line.id, routes};
        if (opt.save)
            await get_restdb_by_line(line.id).update_or_add('city', {id: city.id}, data);
        if (!opt.save)
            console.log(data);
        else if (opt.verbose)
            console.log('+ sync_delivery_for_line_and_city >', data);
        console.log(`${opt.line_i}/${opt.lines_len}`, `[${line.id}]`,
            `${opt.city_i}/${opt.cities_len}`,`[${city.id}]`, city.name,
            'OK', get_dur(start), get_dur(opt.start));
    } catch(e){
        console.log(`${opt.line_i}/${opt.lines_len}`, `[${line.id}]`,
            `${opt.city_i}/${opt.cities_len}`, `[${city.id}]`, city.name,
            'ERROR', e, get_dur(start), get_dur(opt.start));
        opt.errors = opt.errors||{};
        opt.errors[line.id] = opt.errors[line.id]||{};
        opt.errors[line.id][city.id] = e;
    }
}

async function sync_delivery_for_line(line, opt={}){
    if (opt.verbose)
        console.log('+ sync_delivery_for_line <', line, opt);
    const start = Date.now();
    if (!opt.start)
        assign(opt, {start});
    console.log(`started sync delivery for line [${line.id}]`);
    const {cities, cities_keys} = opt;
    let i = 0;
    for (const id of cities_keys)
    {
        i++;
        if (opt.from_city_index && i<opt.from_city_index)
            continue;
        await sync_delivery_for_line_and_city(line, {id, name: cities[id]},
            assign(opt, {city_i: i}));
        if (opt.wait)
            await wait(opt.wait);
    }
    console.log('finished sync delivery by cities in', get_dur(start));
}

async function sync_delivery(opt={}){
    const start = Date.now();
    if (!opt.start)
        assign(opt, {start});
    console.log('started sync delivery');
    const catalog = await get_conf('catalog');
    if (!catalog)
        throw new Error('no catalog');
    const catalog_keys = Object.keys(catalog).filter(k=>{
        return !opt.line || opt.line==k
            || is_array(opt.line) && opt.line.includes(k);
    });
    const lines_len = catalog_keys.length;
    if (!lines_len)
        throw new Error('empty lines');
    const cities = await get_conf('cities');
    if (!cities)
        throw new Error('no cities');
    const cities_keys = Object.keys(cities).filter(k=>{
        return !opt.city || opt.city==k
            || is_array(opt.city) && opt.city.includes(k);
    });
    const cities_len = cities_keys.length;
    if (!cities_len)
        throw new Error('empty cities');
    assign(opt, {cities, cities_keys, cities_len, lines_len});
    let i = 0;
    for (const id of catalog_keys)
    {
        i++;
        console.log(`process product line [${id}] ${i}/${lines_len}`);
        const line = catalog[id];
        const prod = line.products[0].id;
        console.log(`adding product [${prod}] to basket...`);
        const res = await add_to_basket(prod);
        if (!res.result=='success')
            throw new Error(`failed add to basket prod [${prod}]`);
        console.log('product added');
        console.log('getting basket ID...');
        const basket_id = await get_basket_id(opt);
        if (!basket_id)
            throw new Error(`failed get basket ID prod [${prod}]`);
        console.log(`got basket ID [${basket_id}]`);
        await sync_delivery_for_line(line, assign(opt, {line_i: i}));
        console.log(`deleting from basket [${basket_id}]...`);
        await del_from_basket(basket_id);
        console.log('basket is empty');
    }
    if (opt.errors)
        console.log('errors', opt.errors);
    console.log('finished sync delivery in', get_dur(start));
}