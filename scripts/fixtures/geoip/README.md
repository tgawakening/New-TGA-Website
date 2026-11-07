# Test-only GeoIP database

`GeoIP2-Country-Test.mmdb` is MaxMind's synthetic test fixture, downloaded from
https://github.com/maxmind/MaxMind-DB/blob/main/test-data/GeoIP2-Country-Test.mmdb
on 7 November 2026. It is not a production geolocation database. The upstream
repository offers MIT or Apache 2.0 licensing; the MIT license is included here.

The fixture is only used by tests. Production still requires a provisioned,
updated Country database and its appropriate license.
