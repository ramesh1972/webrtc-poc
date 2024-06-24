import { request } from "https";// Node Get ICE STUN and TURN list

function getICEServers() : any {
    let o = {
        format: "urls"
    };

    let bodyString = JSON.stringify(o);

    let options = {
        host: "global.xirsys.net",
        path: "/_turn/colab",
        method: "PUT",
        headers: {
            "Authorization": "Basic " + Buffer.from("rameshvk:bbb53db8-2dc5-11ef-a656-0242ac150002").toString("base64"),
            "Content-Type": "application/json",
            "Content-Length": bodyString.length
        }
    };


    let iceList = "";
    let httpreq = request(options, function (httpres) {
        let str = "";
        httpres.on("data", function (data) { str += data; });
        httpres.on("error", function (e) { console.log("error: ", e); });
        httpres.on("end", function () {
            console.log("ICE List: ", str);
            iceList = JSON.parse(str).v.iceServers;
        });
    });

    httpreq.on("error", function (e) { console.log("request error: ", e); });
    httpreq.end();

    return iceList;
}

export default getICEServers;