export const demoMachines=[
 {id:'demo-1',code:'ESC-001',name:'Escavadeira Atlas',status:'ONLINE',company:{name:'Construtora Horizonte'},currentState:{online:true,voltage:47.8,current:31.2,speed:7.2,signalStrength:-72,latitude:-7.115,longitude:-34.861,updatedAt:new Date().toISOString()},assignments:[{driverProfile:{user:{name:'João Silva'}}}]},
 {id:'demo-2',code:'ESC-002',name:'Escavadeira Boreal',status:'OFFLINE',company:{name:'Construtora Horizonte'},currentState:{online:false,voltage:45.9,current:0,speed:0,signalStrength:-98,latitude:-7.121,longitude:-34.874,updatedAt:new Date(Date.now()-3600000).toISOString()},assignments:[]},
 {id:'demo-3',code:'ESC-003',name:'Escavadeira Cobalto',status:'ALERT',company:{name:'Construtora Horizonte'},currentState:{online:true,voltage:46.2,current:36.7,speed:4.1,signalStrength:-86,latitude:-7.109,longitude:-34.852,updatedAt:new Date().toISOString()},assignments:[]},
 {id:'demo-4',code:'ESC-004',name:'Escavadeira Delta',status:'MAINTENANCE',company:{name:'Construtora Horizonte'},currentState:{online:false,voltage:0,current:0,speed:0,signalStrength:null,latitude:-7.127,longitude:-34.844,updatedAt:new Date().toISOString()},assignments:[]}
];
export const statusLabel={ONLINE:'Online',OFFLINE:'Offline',ALERT:'Em alerta',MAINTENANCE:'Manutenção',DISABLED:'Desativada'};
