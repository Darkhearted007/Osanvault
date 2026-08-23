import { db } from 'hatchable';
export const access='public';
export const methods=['GET'];
export default async function(req,res){const {rows}=await db.query('SELECT layer_code AS id,layer_name AS title,description,authority_reference,source_url,layer_status,sensitivity FROM gis_layers ORDER BY layer_name');const collections=[{id:'assets',title:'ÒsánVault Asset Features',description:'Public map-ready asset geometries with provenance and confidence metadata.',crs:['http://www.opengis.net/def/crs/OGC/1.3/CRS84']},...rows];res.json({collections});}