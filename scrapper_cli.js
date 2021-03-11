/*jshint esversion: 8*/
require = require('esm')(module);
const getopts = require('getopts');
const api = require('./api.js');
const {restdb, config, scrapper, sync} = require('./api_node.js').init();

const help = `Usage: node scrapper.js [options] [command] [params]

Options:
  -t, --type=           filter type or types in sync
  -c, --city=           filter city or cities in sync
  -s, --save            save in sync
  -S, --skip_cities=    skip number of cities in sync
  -v, --verbose         verbose output
  -h, --help            show usage

Commands:
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
  get_products          line_id line_url
  get_conf              conf_name
  get_all_conf
  get_total             type [collection]
  get_live_routes       type city_id
`;

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
            const res = await scrapper.get_routes(arg1, arg2, opt);
            console.log(JSON.stringify(res, null, 2));
            break;
        }
    case 'get_cities':
        console.log(await scrapper.get_cities());
        break;
    case 'add_to_basket':
        console.log(await scrapper.add_to_basket(arg1));
        break;
    case 'get_basket_id':
        console.log(await scrapper.get_basket_id(opt));
        break;
    case 'del_from_basket':
        console.log(await scrapper.del_from_basket(arg1));
        break;
    case 'get_product_lines':
        console.log(await scrapper.get_product_lines());
        break;
    case 'get_products':
        console.log(await scrapper.get_products(arg1, arg2));
        break;
    case 'get_conf':
        console.log(await config.get(arg1));
        break;
    case 'get_all_conf':
        console.log(await config.get_all());
        break;
    case 'get_total':
        {
            const db = api.PRODUCT_TYPE_TO_RESTDB_INSTANCE[arg1] ?
                restdb.get_instance_by_type(arg1) : restdb.get_instance(arg1);
            console.log(await db.get_total(arg2||'city'));
            break;
        }
    case 'get_live_routes':
        {
            const type = arg1, city = arg2;
            const conf = await config.get_all();
            const type2products = api.get_products_by_type(conf.products);
            const prod = type2products[type][0].id;
            await scrapper.add_to_basket(prod);
            const res = await scrapper.get_routes(city, conf.cities[city],
                opt);
            console.log(JSON.stringify(res, null, 2));
            break;
        }
    default:
        console.log(help);
    }
}

if (require.main==module)
    main();