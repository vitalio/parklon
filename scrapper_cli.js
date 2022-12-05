/*jshint esversion: 8*/
import {createRequire} from "module";
const require = createRequire(import.meta.url);
import getopts from 'getopts';
import {PRODUCT_TYPE_TO_RESTDB_INSTANCE, get_products_by_type} from './api/api.js';
import api_node from './api/api_node.js';
const cities = require('./data/cities.json');
const products = require('./data/products.json');
const {restdb, config, scrapper, sync} = api_node.init();

const help = `Usage: node --max-http-header-size 15000 scrapper_cli.js [options] [command] [params]

Options:
  -t, --type=           filter type or types in sync
  -c, --city=           filter city or cities in sync
  -s, --save            save in sync
  -S, --skip_cities=    skip number of cities in sync
  -C, --config          use config to get cities and products
  -v, --verbose         verbose output
  -h, --help            show usage

Commands:
  dummy
  get                   url
  sync_delivery
  sync_products
  sync_cities
  get_order_data        [city_name]
  get_routes            city_id [city_name]
  get_cities
  add_to_basket         prod_id
  get_basket_id
  del_from_basket       basket_id
  get_product_lines
  get_line_products     line_id line_url
  get_products
  get_conf              conf_name
  get_all_conf
  get_total             type [collection]
  get_live_routes       type city_id
`;

const stringify = o=>JSON.stringify(o, null, 4);
const print_json = o=>console.log(stringify(o));

async function main(){
    const opt = getopts(process.argv.slice(2), {
        alias: {
            type: 't',
            city: 'c',
            save: 's',
            verbose: 'v',
            skip_cities: 'S',
            help: 'h',
        },
        boolean: ['s', 'v'],
        string: ['t', 'c', 'S'],
    });
    if (opt.help)
        return void console.log(help);
    const [cmd, arg1, arg2] = opt._;
    switch (cmd)
    {
    case 'get':
        console.log(await scrapper.get(arg1, opt));
        break;
    case 'dummy':
        await scrapper.dummy();
        break;
    case 'sync_delivery':
    case 'sync_products':
    case 'sync_cities':
        await sync[cmd](opt);
        break;
    case 'get_order_data':
        console.log(await scrapper.get_order_data(arg1));
        break;
    case 'get_routes':
        {
            print_json(await scrapper.get_routes(arg1, arg2, opt));
            break;
        }
    case 'get_cities':
        print_json(await scrapper.get_cities(opt));
        break;
    case 'add_to_basket':
        print_json(await scrapper.add_to_basket(arg1, opt));
        break;
    case 'get_basket_id':
        console.log(await scrapper.get_basket_id(opt));
        break;
    case 'del_from_basket':
        console.log(await scrapper.del_from_basket(arg1));
        break;
    case 'get_product_lines':
        print_json(await scrapper.get_product_lines(opt));
        break;
    case 'get_line_products':
        print_json(await scrapper.get_line_products(arg1, arg2));
        break;
    case 'get_products':
        print_json(await scrapper.get_products(opt));
        break;
    case 'get_conf':
        print_json(await config.get(arg1));
        break;
    case 'get_all_conf':
        print_json(await config.get_all());
        break;
    case 'get_total':
        {
            const db = PRODUCT_TYPE_TO_RESTDB_INSTANCE[arg1] ?
                restdb.get_instance_by_type(arg1) : restdb.get_instance(arg1);
            console.log(await db.get_total(arg2||'city'));
            break;
        }
    case 'get_live_routes':
        {
            const type = arg1, city = arg2;
            const conf = opt.config ? await config.get_all()
                : {cities, products};
            const type2products = get_products_by_type(conf.products);
            const prod = type2products[type][0].id;
            await scrapper.add_to_basket(prod, opt);
            const res = await scrapper.get_routes(city, conf.cities[city],
                opt);
            print_json(res);
            break;
        }
    default:
        console.log(help);
    }
}

main();