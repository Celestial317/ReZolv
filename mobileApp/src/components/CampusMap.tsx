import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import WebViewNative, { type WebViewMessageEvent } from "react-native-webview";
import { NavIcon } from "./Icons";
import { Txt } from "./Txt";
import { CAMPUS_BOUNDS, CAMPUS_CENTER, CAMPUS_POLYGON, type LatLng } from "@/lib/campus";
import { color } from "@/lib/theme";

export type MapMarker = { id: string; lat: number; lng: number; count: number; color: string };

// react-native-webview 14 ships class-component typings that React 19 types reject; this is a typing-only cast.
const WebView = WebViewNative as unknown as React.ComponentType<any>;

type Props = {
  markers?: MapMarker[];
  /** "pin": a fixed pin in the middle and the map moves under it. */
  mode?: "view" | "pin";
  center?: LatLng;
  zoom?: number;
  activeId?: string | null;
  controls?: boolean;
  onCenter?: (lat: number, lng: number) => void;
  onMarker?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

function buildHtml(center: LatLng, zoom: number) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;margin:0;background:#e8eeec}
.pin{background:none;border:0}
.pin span{display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #fff;color:#fff;font:800 13px sans-serif;box-shadow:0 2px 8px rgba(20,35,42,.35)}
.leaflet-control-attribution{font-size:10px}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var POLY=${JSON.stringify(CAMPUS_POLYGON)}, BOUNDS=${JSON.stringify(CAMPUS_BOUNDS)}, CENTER=${JSON.stringify(center)}, ZOOM=${zoom};
function post(o){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
var map=L.map('map',{zoomControl:false,minZoom:18,maxZoom:20,zoomSnap:0.5,maxBounds:BOUNDS,maxBoundsViscosity:1}).setView(CENTER,ZOOM);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:20,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.polygon([[[-85,-180],[-85,180],[85,180],[85,-180]],POLY],{stroke:false,fillColor:'#14232a',fillOpacity:.28,interactive:false}).addTo(map);
L.polygon(POLY,{color:'#0f6b5e',weight:2,dashArray:'6 6',fill:false,interactive:false}).addTo(map);
var layer=L.layerGroup().addTo(map);
window.setMarkers=function(list,active){
  layer.clearLayers();
  list.forEach(function(m){
    var d=m.count>=40?40:32, ring=m.id===active?'#14232a':'#fff';
    var icon=L.divIcon({className:'pin',iconSize:[d,d],iconAnchor:[d/2,d/2],html:'<span style="width:'+d+'px;height:'+d+'px;background:'+m.color+';border-color:'+ring+'">'+m.count+'</span>'});
    L.marker([m.lat,m.lng],{icon:icon}).on('click',function(){post({type:'marker',id:m.id});}).addTo(layer);
  });
};
map.on('moveend',function(){var c=map.getCenter();post({type:'center',lat:c.lat,lng:c.lng});});
post({type:'ready'});
</script></body></html>`;
}

/** OpenStreetMap (Leaflet in a WebView), locked to the college campus. */
export default function CampusMap({ markers = [], mode = "view", center = CAMPUS_CENTER, zoom = 18, activeId, controls = true, onCenter, onMarker, style }: Props) {
  const web = useRef<{ injectJavaScript: (js: string) => void } | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildHtml(center, zoom), []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback((js: string) => web.current?.injectJavaScript(`${js}; true;`), []);

  useEffect(() => {
    if (ready) run(`window.setMarkers(${JSON.stringify(markers)}, ${JSON.stringify(activeId ?? null)})`);
  }, [ready, markers, activeId, run]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === "ready") setReady(true);
      else if (m.type === "center") onCenter?.(m.lat, m.lng);
      else if (m.type === "marker") onMarker?.(m.id);
    } catch {
      // ignore messages that are not ours
    }
  };

  return (
    <View style={[s.box, style]}>
      <WebView
        ref={web}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://rezolv.app" }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        style={{ flex: 1, backgroundColor: "#e8eeec" }}
      />
      {mode === "pin" && (
        <View pointerEvents="none" style={s.pinWrap}>
          <Svg width={40} height={54} viewBox="0 0 46 62">
            <Path d="M23 59C23 59 3 38 3 22a20 20 0 0 1 40 0c0 16-20 37-20 37z" fill={color.ink} stroke="#fff" strokeWidth={4} />
            <Circle cx="23" cy="22" r="8" fill={color.aqua} />
          </Svg>
        </View>
      )}
      {controls && (
        <View style={s.ctl}>
          <Pressable style={s.ctlBtn} accessibilityLabel="Zoom in" onPress={() => run("map.zoomIn()")}><Txt w="heavy" size={24}>+</Txt></Pressable>
          <Pressable style={s.ctlBtn} accessibilityLabel="Zoom out" onPress={() => run("map.zoomOut()")}><Txt w="heavy" size={24}>−</Txt></Pressable>
          <Pressable style={s.ctlBtn} accessibilityLabel="Recentre" onPress={() => run(`map.setView(${JSON.stringify(center)}, ${zoom})`)}><NavIcon color={color.green} size={22} /></Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: "#e8eeec" },
  pinWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingBottom: 54 },
  ctl: { position: "absolute", right: 12, bottom: 36, gap: 8 },
  ctlBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center",
    ...(Platform.OS === "android" ? { elevation: 3 } : {}),
  },
});
