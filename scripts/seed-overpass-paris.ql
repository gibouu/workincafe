[out:json][timeout:120];
area["name"="Paris"]["admin_level"="6"]->.searchArea;
(
  node["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  node["tourism"="hotel"](area.searchArea);
  way["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  way["tourism"="hotel"](area.searchArea);
);
out body center;
