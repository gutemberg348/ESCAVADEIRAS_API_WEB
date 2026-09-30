import mqtt from 'mqtt';

const url=process.env.MQTT_URL||'mqtt://localhost:1883';
const interval=Number(process.env.SIM_INTERVAL||3000);
const devices=(process.env.SIM_DEVICES||'DEV-ESC-001,DEV-ESC-002,DEV-ESC-003,DEV-ESC-004').split(',');
const tokens=Object.fromEntries((process.env.SIM_DEVICE_TOKENS||'').split(',').filter(Boolean).map((entry)=>{const separator=entry.indexOf(':');return[entry.slice(0,separator),entry.slice(separator+1)]}));
const client=mqtt.connect(url,{username:process.env.MQTT_USERNAME||undefined,password:process.env.MQTT_PASSWORD||undefined});
const random=(base,spread)=>Number((base+(Math.random()-.5)*spread).toFixed(2));

client.on('connect',()=>{
  console.log(`Simulator connected to ${url} (${devices.length} devices)`);
  setInterval(()=>devices.forEach((device,index)=>{
    const identity=tokens[device]?{authToken:tokens[device]}:{};
    const payload={...identity,timestamp:new Date().toISOString(),latitude:random(-7.115-index*.004,.002),longitude:random(-34.861-index*.002,.002),speed:Math.max(0,random(index===1?0:7,3)),voltage:random(47.8,1),current:random(31.2,4),signalStrength:Math.round(random(-72,12)),gpsSatellites:10,engineState:index!==1};
    client.publish(`machines/${device}/telemetry`,JSON.stringify(payload),{qos:1});
    client.publish(`machines/${device}/status`,JSON.stringify({...identity,online:index!==1,firmware:'1.0.0',signal:payload.signalStrength,timestamp:payload.timestamp}),{qos:1,retain:true});
  }),interval);
});
client.on('error',(error)=>console.error(error.message));
