let cities;

async function init(){
    console.log('XXX init');
    // const res = await fetch('../cities.json');
    // cities = await res.json();
    // console.log('XXX cities', cities);
    $('#city').autoComplete({
        resolverSettings: {
            url: '../cities.json'
        }
    });
}
init();