let cities;

async function init(){
    console.log('XXX init');
    const res = await fetch('../cities.json');
    cities = await res.json();
    console.log('XXX cities', cities);
}
init();

function init_ui(){
    console.log('XXX ui inited');
}