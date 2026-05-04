[out:json][timeout:180];
area["name"="Paris"]["admin_level"="6"]->.searchArea;
(
  node["amenity"~"^(cafe|library|fast_food|restaurant|coworking_space|ice_cream|internet_cafe)$"](area.searchArea);
  node["shop"~"^(bakery|coffee|tea|pastry)$"](area.searchArea);
  node["tourism"="hotel"](area.searchArea);
  way["amenity"~"^(cafe|library|fast_food|restaurant|coworking_space|ice_cream|internet_cafe)$"](area.searchArea);
  way["shop"~"^(bakery|coffee|tea|pastry)$"](area.searchArea);
  way["tourism"="hotel"](area.searchArea);
);
out body center;
