"use client"

import { useState, useEffect, useRef } from "react"
import { Shuffle, X, Music, Loader2 } from "lucide-react"

type Track = {
  id: string
  url: string
  title: string
  artist: string
}

// Consolidated list of all your SoundCloud tracks
const SOUNDCLOUD_LIKES: Track[] = [
  // New tracks from your latest list
  {
    id: "do-not-question",
    title: "Do Not Question",
    artist: "sylvanlacue",
    url: "https://soundcloud.com/sylvanlacue/do-not-question",
  },
  {
    id: "logic-925-prod-swiff-d",
    title: "Logic 925 Prod Swiff D",
    artist: "swagytracks",
    url: "https://soundcloud.com/swagytracks/logic-925-prod-swiff-d",
  },
  {
    id: "middle-of-south-florida-feat-prez-p",
    title: "Middle Of South Florida Feat Prez P",
    artist: "sylvanlacue",
    url: "https://soundcloud.com/sylvanlacue/middle-of-south-florida-feat-prez-p",
  },
  {
    id: "damnremix",
    title: "Damn Remix",
    artist: "bebas100",
    url: "https://soundcloud.com/bebas100/damnremix",
  },
  {
    id: "wasted-feat-lil-uzi-vert",
    title: "Wasted Feat Lil Uzi Vert",
    artist: "uiceheidd",
    url: "https://soundcloud.com/uiceheidd/wasted-feat-lil-uzi-vert",
  },
  {
    id: "childish-gambino-covers-tamia-so-into-you",
    title: "Childish Gambino Covers Tamia So Into You",
    artist: "uggybearandstarsky",
    url: "https://soundcloud.com/uggybearandstarsky/childish-gambino-covers-tamia-so-into-you",
  },
  {
    id: "sheck-wes-lebron-james",
    title: "Sheck Wes Lebron James",
    artist: "jessedemedeiross",
    url: "https://soundcloud.com/jessedemedeiross/sheck-wes-lebron-james",
  },
  {
    id: "untitledset",
    title: "Untitled Set",
    artist: "bakedgood",
    url: "https://soundcloud.com/bakedgood/untitledset",
  },
  // Original working tracks
  {
    id: "sade-sweetest-taboo-november-rose-amapiano-remix",
    title: "Sade Sweetest Taboo November Rose Amapiano Remix",
    artist: "novemberrosemusic",
    url: "https://soundcloud.com/novemberrosemusic/sade-sweetest-taboo-november-rose-amapiano-remix",
  },
  {
    id: "name",
    title: "Name",
    artist: "theconcreteleaksystem",
    url: "https://soundcloud.com/theconcreteleaksystem/name",
  },
  {
    id: "yukon-x-up-dj-hunny-bee-mashup",
    title: "Yukon X Up Dj Hunny Bee Mashup",
    artist: "djhunnybee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-mashup",
  },
  {
    id: "habibi-funk-beirut",
    title: "Habibi Funk Beirut",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-beirut",
  },
  {
    id: "yukon-x-up-dj-hunny-bee-remix",
    title: "Yukon X Up Dj Hunny Bee Remix",
    artist: "djhunnybee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-remix",
  },
  {
    id: "four-tet-insect-near-piha-beach",
    title: "Four Tet Insect Near Piha Beach",
    artist: "user-982065028",
    url: "https://soundcloud.com/user-982065028/four-tet-insect-near-piha-beach",
  },
  {
    id: "chopsuey",
    title: "Chopsuey",
    artist: "osive",
    url: "https://soundcloud.com/osive/chopsuey",
  },
  {
    id: "gordos-dilemma",
    title: "Gordos Dilemma",
    artist: "gordoszn",
    url: "https://soundcloud.com/gordoszn/gordos-dilemma",
  },
  {
    id: "08-compton-state-of-mind",
    title: "08 Compton State Of Mind",
    artist: "miles-davis-29",
    url: "https://soundcloud.com/miles-davis-29/08-compton-state-of-mind",
  },
  {
    id: "fidde-i-wonder-yuno-hu-vision",
    title: "Fidde I Wonder Yuno Hu Vision",
    artist: "miguelmancha",
    url: "https://soundcloud.com/miguelmancha/fidde-i-wonder-yuno-hu-vision",
  },
  {
    id: "sango2",
    title: "Sango2",
    artist: "pincheporvida",
    url: "https://soundcloud.com/pincheporvida/sango2",
  },
  {
    id: "dipset-x-future-i-really-mean",
    title: "Dipset X Future I Really Mean",
    artist: "sangobeats",
    url: "https://soundcloud.com/sangobeats/dipset-x-future-i-really-mean",
  },
  {
    id: "mos-def-auditorium-2",
    title: "Mos Def Auditorium 2",
    artist: "beaubouthillier-1",
    url: "https://soundcloud.com/beaubouthillier-1/mos-def-auditorium-2",
  },
  {
    id: "blemforreal",
    title: "Blemforreal",
    artist: "davidmackaymusic",
    url: "https://soundcloud.com/davidmackaymusic/blemforreal",
  },
  {
    id: "tems-me-u-blk-remix",
    title: "Tems Me U Blk Remix",
    artist: "blkmvsic",
    url: "https://soundcloud.com/blkmvsic/tems-me-u-blk-remix",
  },
  {
    id: "first-day-of-my-life-bright",
    title: "First Day Of My Life Bright",
    artist: "larryfisherman",
    url: "https://soundcloud.com/larryfisherman/first-day-of-my-life-bright",
  },
  {
    id: "phoenix-1",
    title: "Phoenix 1",
    artist: "youngthugworld",
    url: "https://soundcloud.com/youngthugworld/phoenix-1",
  },
  {
    id: "she-notice",
    title: "She Notice",
    artist: "youngthung",
    url: "https://soundcloud.com/youngthung/she-notice",
  },
  {
    id: "casts-of-a-dreamer-full-tape",
    title: "Casts Of A Dreamer Full Tape",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/casts-of-a-dreamer-full-tape",
  },
  {
    id: "gordo-x-drake-healing-my-pal-al-remix-1",
    title: "Gordo X Drake Healing My Pal Al Remix 1",
    artist: "mypalalmusic",
    url: "https://soundcloud.com/mypalalmusic/gordo-x-drake-healing-my-pal-al-remix-1",
  },
  {
    id: "mitsubishi-sony",
    title: "Mitsubishi Sony",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/mitsubishi-sony",
  },
  {
    id: "gilga-01-childish-gambino-1",
    title: "Gilga 01 Childish Gambino 1",
    artist: "david-nelson-494707975",
    url: "https://soundcloud.com/david-nelson-494707975/gilga-01-childish-gambino-1",
  },
  {
    id: "partynextdoor-showing-you-baile-baile-funk-edit",
    title: "Partynextdoor Showing You Baile Baile Funk Edit",
    artist: "ang-official",
    url: "https://soundcloud.com/ang-official/partynextdoor-showing-you-baile-baile-funk-edit",
  },
  {
    id: "beyonce-end-of-time-sydney-sousa-baile-funk-edit",
    title: "Beyonce End Of Time Sydney Sousa Baile Funk Edit",
    artist: "dj-sydney-sousa",
    url: "https://soundcloud.com/dj-sydney-sousa/beyonce-end-of-time-sydney-sousa-baile-funk-edit",
  },
  {
    id: "peggy-gou-it-goes-like-nanana-baile-funk-edit",
    title: "Peggy Gou It Goes Like Nanana Baile Funk Edit",
    artist: "caiohot",
    url: "https://soundcloud.com/caiohot/peggy-gou-it-goes-like-nanana-baile-funk-edit",
  },
  {
    id: "sango-amor-di-american-loverboy",
    title: "Sango Amor Di American Loverboy",
    artist: "manlikesirene",
    url: "https://soundcloud.com/manlikesirene/sango-amor-di-american-loverboy",
  },
  {
    id: "bitch-dont-kill-my-funk-b",
    title: "Bitch Dont Kill My Funk B",
    artist: "b_smileloco98",
    url: "https://soundcloud.com/b_smileloco98/bitch-dont-kill-my-funk-b",
  },
  {
    id: "chamber-of-reflection-brazilian-funk-remix",
    title: "Chamber Of Reflection Brazilian Funk Remix",
    artist: "user-167742358",
    url: "https://soundcloud.com/user-167742358/chamber-of-reflection-brazilian-funk-remix",
  },
  {
    id: "fisherrr-shekdash-remix",
    title: "Fisherrr Shekdash Remix",
    artist: "shekdash",
    url: "https://soundcloud.com/shekdash/fisherrr-shekdash-remix",
  },
  {
    id: "slim",
    title: "Slim",
    artist: "musicbysamson",
    url: "https://soundcloud.com/musicbysamson/slim",
  },
  {
    id: "rich-baby-daddy-pherris-edit-a-side",
    title: "Rich Baby Daddy Pherris Edit A Side",
    artist: "pherrismusic",
    url: "https://soundcloud.com/pherrismusic/rich-baby-daddy-pherris-edit-a-side",
  },
  {
    id: "lose-my-breath-yanghi-amapiano-edit",
    title: "Lose My Breath Yanghi Amapiano Edit",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/lose-my-breath-yanghi-amapiano-edit",
  },
  {
    id: "kanye-west-i-wonder-yanghi-amapiano-edit-free-dl-1",
    title: "Kanye West I Wonder Yanghi Amapiano Edit Free Dl 1",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/kanye-west-i-wonder-yanghi-amapiano-edit-free-dl-1",
  },
  {
    id: "gunna-fukumean-yanghi-baile-edit",
    title: "Gunna Fukumean Yanghi Baile Edit",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/gunna-fukumean-yanghi-baile-edit",
  },
  {
    id: "4batz-act-ii-bailefunk-adr",
    title: "4batz Act Ii Bailefunk Adr",
    artist: "alldayrayatx",
    url: "https://soundcloud.com/alldayrayatx/4batz-act-ii-bailefunk-adr",
  },
  {
    id: "4batzqulianoedit",
    title: "4batz Quliano Edit",
    artist: "qulianomusic",
    url: "https://soundcloud.com/qulianomusic/4batzqulianoedit",
  },
  {
    id: "another-you-feat-tony-williams",
    title: "Another You Feat Tony Williams",
    artist: "kany3unreleased",
    url: "https://soundcloud.com/kany3unreleased/another-you-feat-tony-williams",
  },
  {
    id: "raf-republic-mar-7",
    title: "RAF Republic Mar 7",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/raf-republic-mar-7",
  },
  {
    id: "not-over-prod-kaytranada",
    title: "Not Over Prod Kaytranada",
    artist: "kaycyypluto",
    url: "https://soundcloud.com/kaycyypluto/not-over-prod-kaytranada",
  },
  {
    id: "ill-b-late-fa-dat-1",
    title: "Ill B Late Fa Dat 1",
    artist: "soundsofadream",
    url: "https://soundcloud.com/soundsofadream/ill-b-late-fa-dat-1",
  },
  {
    id: "cirez-d-marquee-las-vegas-2017-id",
    title: "Cirez D Marquee Las Vegas 2017 ID",
    artist: "gustav-granath",
    url: "https://soundcloud.com/gustav-granath/cirez-d-marquee-las-vegas-2017-id",
  },
  {
    id: "texas-speed-white-ferrari0",
    title: "Texas Speed White Ferrari",
    artist: "dwellsnyc",
    url: "https://soundcloud.com/dwellsnyc/texas-speed-white-ferrari0",
  },
  {
    id: "come-and-see-me",
    title: "Come And See Me",
    artist: "mixedbyjba",
    url: "https://soundcloud.com/mixedbyjba/come-and-see-me",
  },
  {
    id: "liability-sahara-remix",
    title: "Liability Sahara Remix",
    artist: "saharabeats",
    url: "https://soundcloud.com/saharabeats/liability-sahara-remix",
  },
  {
    id: "tay-k-pain-1993-kd-remix",
    title: "Tay K Pain 1993 KD Remix",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/tay-k-pain-1993-kd-remix",
  },
  {
    id: "brent-faiyaz-jackie-brown",
    title: "Brent Faiyaz Jackie Brown",
    artist: "ekany",
    url: "https://soundcloud.com/ekany/brent-faiyaz-jackie-brown",
  },
  {
    id: "drake-jaded-ekany-amapiano-remix",
    title: "Drake Jaded Ekany Amapiano Remix",
    artist: "ekany",
    url: "https://soundcloud.com/ekany/drake-jaded-ekany-amapiano-remix",
  },
  {
    id: "massano-the-blaze",
    title: "Massano The Blaze",
    artist: "massanomusic",
    url: "https://soundcloud.com/massanomusic/massano-the-blaze",
  },
  {
    id: "kanye-west-lost-in-the-world-arpiar-edit-krasse-tone-remix-2",
    title: "Kanye West Lost In The World Arpiar Edit Krasse Tone Remix 2",
    artist: "adil-cirak",
    url: "https://soundcloud.com/adil-cirak/kanye-west-lost-in-the-world-arpiar-edit-krasse-tone-remix-2",
  },
  {
    id: "playboi-carti-gunna-ysl-x-crush-on-you-kd-mix",
    title: "Playboi Carti Gunna YSL X Crush On You KD Mix",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/playboi-carti-gunna-ysl-x-crush-on-you-kd-mix",
  },
  {
    id: "dave-central-cee-sprinter-govi-remix",
    title: "Dave Central Cee Sprinter Govi Remix",
    artist: "govibeats",
    url: "https://soundcloud.com/govibeats/dave-central-cee-sprinter-govi-remix",
  },
  {
    id: "jit-wit-da-wicks-prod-454",
    title: "Jit Wit Da Wicks Prod 454",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/jit-wit-da-wicks-prod-454",
  },
  {
    id: "science-class-westside-gunn",
    title: "Science Class Westside Gunn",
    artist: "user-230513036",
    url: "https://soundcloud.com/user-230513036/science-class-westside-gunn",
  },
  {
    id: "frank-ocean-new-music-from-blonded-xmas-episode",
    title: "Frank Ocean New Music From Blonded Xmas Episode",
    artist: "blondedprovider",
    url: "https://soundcloud.com/blondedprovider/frank-ocean-new-music-from-blonded-xmas-episode",
  },
  {
    id: "frank-ocean-white-ferrari-2023-coachella-version-remake-2",
    title: "Frank Ocean White Ferrari 2023 Coachella Version Remake 2",
    artist: "jxckstxlly",
    url: "https://soundcloud.com/jxckstxlly/frank-ocean-white-ferrari-2023-coachella-version-remake-2",
  },
  {
    id: "dear-april-justice-remix",
    title: "Dear April Justice Remix",
    artist: "user-126122356",
    url: "https://soundcloud.com/user-126122356/dear-april-justice-remix",
  },
  {
    id: "slide",
    title: "Slide",
    artist: "trippy-turtle",
    url: "https://soundcloud.com/trippy-turtle/slide",
  },
  {
    id: "at-your-best",
    title: "At Your Best",
    artist: "cashcobainmhpg",
    url: "https://soundcloud.com/cashcobainmhpg/at-your-best",
  },
  {
    id: "hot-in-circo-loco",
    title: "Hot In Circo Loco",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/hot-in-circo-loco",
  },
  {
    id: "kdot-x-radiohead",
    title: "Kdot X Radiohead",
    artist: "dwellsnyc",
    url: "https://soundcloud.com/dwellsnyc/kdot-x-radiohead",
  },
  {
    id: "mac-miller-x-mf-doom-happy-doomsday-kd-mix",
    title: "Mac Miller X MF Doom Happy Doomsday KD Mix",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/mac-miller-x-mf-doom-happy-doomsday-kd-mix",
  },
  {
    id: "beyonce-x-stardust-break-my-soul-sango-mix",
    title: "Beyonce X Stardust Break My Soul Sango Mix",
    artist: "sangobeats",
    url: "https://soundcloud.com/sangobeats/beyonce-x-stardust-break-my-soul-sango-mix",
  },
  {
    id: "quavo-without-you",
    title: "Quavo Without You",
    artist: "quavoofficial",
    url: "https://soundcloud.com/quavoofficial/quavo-without-you",
  },
  {
    id: "merry-slizzmas",
    title: "Merry Slizzmas",
    artist: "cashcobainmhpg",
    url: "https://soundcloud.com/cashcobainmhpg/merry-slizzmas",
  },
  {
    id: "keinemusik-radio-show-by-reznik-25112022",
    title: "Keinemusik Radio Show By Reznik 25112022",
    artist: "keinemusik",
    url: "https://soundcloud.com/keinemusik/keinemusik-radio-show-by-reznik-25112022",
  },
  {
    id: "it-g-hot-in-mi-bumber-edit-pack-teaser",
    title: "It G Hot In Mi Bumber Edit Pack Teaser",
    artist: "manlikesirene",
    url: "https://soundcloud.com/manlikesirene/it-g-hot-in-mi-bumber-edit-pack-teaser",
  },
  {
    id: "novacane-frank-ocean-jun-tanaka-edit",
    title: "Novacane Frank Ocean Jun Tanaka Edit",
    artist: "dj-jun1990",
    url: "https://soundcloud.com/dj-jun1990/novacane-frank-ocean-jun-tanaka-edit",
  },
  {
    id: "waste-no-ties",
    title: "Waste No Ties",
    artist: "briimusic",
    url: "https://soundcloud.com/briimusic/waste-no-ties",
  },
  {
    id: "get-u-out-tha-kitchen",
    title: "Get U Out Tha Kitchen",
    artist: "drolavish",
    url: "https://soundcloud.com/drolavish/get-u-out-tha-kitchen",
  },
  {
    id: "mlk-feat-trouble-shad-da-god",
    title: "MLK Feat Trouble Shad Da God",
    artist: "youngthugworld",
    url: "https://soundcloud.com/youngthugworld/mlk-feat-trouble-shad-da-god",
  },
  {
    id: "shawny-binladen-yellowtears",
    title: "Shawny Binladen Yellowtears",
    artist: "james-belcher-9",
    url: "https://soundcloud.com/james-belcher-9/shawny-binladen-yellowtears",
  },
  {
    id: "hbk-freestyle",
    title: "HBK Freestyle",
    artist: "drolavish",
    url: "https://soundcloud.com/drolavish/hbk-freestyle",
  },
  {
    id: "brent-faiyaz-all-mine-dwells-rmx",
    title: "Brent Faiyaz All Mine Dwells RMX",
    artist: "dwellsnyc",
    url: "https://soundcloud.com/dwellsnyc/brent-faiyaz-all-mine-dwells-rmx",
  },
  {
    id: "asap-rocky-x-dr-gabba-mixed-by-kd_muzak",
    title: "ASAP Rocky X Dr Gabba Mixed By KD Muzak",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/asap-rocky-x-dr-gabba-mixed-by-kd_muzak",
  },
  {
    id: "wale-ft-j-cole-winter-schemes",
    title: "Wale Ft J Cole Winter Schemes",
    artist: "fevermcfly",
    url: "https://soundcloud.com/fevermcfly/wale-ft-j-cole-winter-schemes",
  },
  {
    id: "welcome-back-chilly",
    title: "Welcome Back Chilly",
    artist: "muathmy",
    url: "https://soundcloud.com/muathmy/welcome-back-chilly",
  },
  {
    id: "fast-trax-3",
    title: "Fast Trax 3",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/fast-trax-3",
  },
  {
    id: "tie-that-binds-vs-rmx",
    title: "Tie That Binds VS RMX",
    artist: "voidstryker",
    url: "https://soundcloud.com/voidstryker/tie-that-binds-vs-rmx",
  },
  {
    id: "semi-on-em-1979",
    title: "Semi On Em 1979",
    artist: "dwellsnyc",
    url: "https://soundcloud.com/dwellsnyc/semi-on-em-1979",
  },
  {
    id: "central-cee-doja-cmano-remix",
    title: "Central Cee Doja Cmano Remix",
    artist: "cmano",
    url: "https://soundcloud.com/cmano/central-cee-doja-cmano-remix",
  },
  {
    id: "other-shit-playboi-carti-josh",
    title: "Other Shit Playboi Carti Josh",
    artist: "josh-christian-532114961l",
    url: "https://soundcloud.com/josh-christian-532114961l/other-shit-playboi-carti-josh",
  },
  {
    id: "praise-the-lord-durdenhauer-edit",
    title: "Praise The Lord Durdenhauer Edit",
    artist: "durdenhauer",
    url: "https://soundcloud.com/durdenhauer/praise-the-lord-durdenhauer-edit",
  },
  {
    id: "drake-a-keeper-open-till-l8-remix",
    title: "Drake A Keeper Open Till L8 Remix",
    artist: "opentilll8",
    url: "https://soundcloud.com/opentilll8/drake-a-keeper-open-till-l8-remix",
  },
  {
    id: "track-9-1",
    title: "Track 9 1",
    artist: "skepta",
    url: "https://soundcloud.com/skepta/track-9-1",
  },
  {
    id: "flex-up-prod-by-maaly-raw",
    title: "Flex Up Prod By Maaly Raw",
    artist: "liluzivert",
    url: "https://soundcloud.com/liluzivert/flex-up-prod-by-maaly-raw",
  },
  {
    id: "glock-in-my-purse-prod-by-mustard",
    title: "Glock In My Purse Prod By Mustard",
    artist: "liluzivert",
    url: "https://soundcloud.com/liluzivert/glock-in-my-purse-prod-by-mustard",
  },
  {
    id: "off-the-grid",
    title: "Off The Grid",
    artist: "juel-sanchez",
    url: "https://soundcloud.com/juel-sanchez/off-the-grid",
  },
  {
    id: "tlop5",
    title: "TLOP5",
    artist: "pierrebourne",
    url: "https://soundcloud.com/pierrebourne/tlop5",
  },
  {
    id: "drake-sticky-zack-bia-remix",
    title: "Drake Sticky Zack Bia Remix",
    artist: "zackbia",
    url: "https://soundcloud.com/zackbia/drake-sticky-zack-bia-remix",
  },
  {
    id: "jeff-mills-changes-of-life",
    title: "Jeff Mills Changes Of Life",
    artist: "discofanatic",
    url: "https://soundcloud.com/discofanatic/jeff-mills-changes-of-life",
  },
  {
    id: "cirez-d-on-off-pryda-remix",
    title: "Cirez D On Off Pryda Remix",
    artist: "gustav-granath",
    url: "https://soundcloud.com/gustav-granath/cirez-d-on-off-pryda-remix",
  },
  {
    id: "cut-her-off-pierre-bourne",
    title: "Cut Her Off Pierre Bourne",
    artist: "202-exclusive",
    url: "https://soundcloud.com/202-exclusive/cut-her-off-pierre-bourne",
  },
  {
    id: "kendrick-lamar-n95-never-dull-remix",
    title: "Kendrick Lamar N95 Never Dull Remix",
    artist: "neverdullmusic",
    url: "https://soundcloud.com/neverdullmusic/kendrick-lamar-n95-never-dull-remix",
  },
  {
    id: "idris-muhammad-could-heaven-ever-be-like-this-house-remix",
    title: "Idris Muhammad Could Heaven Ever Be Like This House Remix",
    artist: "julas-beats",
    url: "https://soundcloud.com/julas-beats/idris-muhammad-could-heaven-ever-be-like-this-house-remix",
  },
  {
    id: "aj-tracey-naila-conducta-edit",
    title: "AJ Tracey Naila Conducta Edit",
    artist: "jude-noon-790532112",
    url: "https://soundcloud.com/jude-noon-790532112/aj-tracey-naila-conducta-edit",
  },
  {
    id: "1-2-step-ciara-remix",
    title: "1 2 Step Ciara Remix",
    artist: "samgellaitry",
    url: "https://soundcloud.com/samgellaitry/1-2-step-ciara-remix",
  },
  {
    id: "pharrell-and-kanye-west-number",
    title: "Pharrell And Kanye West Number",
    artist: "samgellaitry",
    url: "https://soundcloud.com/samgellaitry/pharrell-and-kanye-west-number",
  },
  {
    id: "chief-keef-f-lil-durk-gotta",
    title: "Chief Keef F Lil Durk Gotta",
    artist: "2hunned",
    url: "https://soundcloud.com/2hunned/chief-keef-f-lil-durk-gotta",
  },
  {
    id: "nba-youngboy-turnt-up-prod",
    title: "NBA Youngboy Turnt Up Prod",
    artist: "user-927325574",
    url: "https://soundcloud.com/user-927325574/nba-youngboy-turnt-up-prod",
  },
  {
    id: "kanye-west-white-dress-other",
    title: "Kanye West White Dress Other",
    artist: "sonboronic-1",
    url: "https://soundcloud.com/sonboronic-1/kanye-west-white-dress-other",
  },
  {
    id: "kanye-west-eyes-closed",
    title: "Kanye West Eyes Closed",
    artist: "undergroundfadetv",
    url: "https://soundcloud.com/undergroundfadetv/kanye-west-eyes-closed",
  },
  {
    id: "heartloosex",
    title: "Heartloosex",
    artist: "spliffhappy",
    url: "https://soundcloud.com/spliffhappy/heartloosex",
  },
  {
    id: "kanye-west-get-well-soon-mixtape-2002",
    title: "Kanye West Get Well Soon Mixtape 2002",
    artist: "hip-hop-underground-776271975",
    url: "https://soundcloud.com/hip-hop-underground-776271975/kanye-west-get-well-soon-mixtape-2002",
  },
  {
    id: "champagne-stains",
    title: "Champagne Stains",
    artist: "sexdrugslang",
    url: "https://soundcloud.com/sexdrugslang/champagne-stains",
  },
  {
    id: "24-og-kanye-ft-ssc-kaycyy",
    title: "24 OG Kanye Ft SSC Kaycyy",
    artist: "user-33366669",
    url: "https://soundcloud.com/user-33366669/24-og-kanye-ft-ssc-kaycyy",
  },
  {
    id: "teriyaki-funk-150-wile-out",
    title: "Teriyaki Funk 150 Wile Out",
    artist: "wileoutmusic",
    url: "https://soundcloud.com/wileoutmusic/teriyaki-funk-150-wile-out",
  },
  {
    id: "ghostrider",
    title: "Ghostrider",
    artist: "madeintyo",
    url: "https://soundcloud.com/madeintyo/ghostrider",
  },
  {
    id: "stay-up-feat-lancey-foux-prod-wonda-gurl",
    title: "Stay Up Feat Lancey Foux Prod Wonda Gurl",
    artist: "kaycyypluto",
    url: "https://soundcloud.com/kaycyypluto/stay-up-feat-lancey-foux-prod-wonda-gurl",
  },
  {
    id: "rumors-90s-version",
    title: "Rumors 90s Version",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/rumors-90s-version",
  },
  {
    id: "intoxikated-dro-lavish-prod-1mattmarvin",
    title: "Intoxikated Dro Lavish Prod 1mattmarvin",
    artist: "drolavish",
    url: "https://soundcloud.com/drolavish/intoxikated-dro-lavish-prod-1mattmarvin",
  },
  {
    id: "pierre-bourne-captain-save-a-hoe",
    title: "Pierre Bourne Captain Save A Hoe",
    artist: "oganja",
    url: "https://soundcloud.com/oganja/pierre-bourne-captain-save-a-hoe",
  },
  {
    id: "7-its-up",
    title: "7 Its Up",
    artist: "678uno",
    url: "https://soundcloud.com/678uno/7-its-up",
  },
  {
    id: "andromeda-by-sweeterman",
    title: "Andromeda By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/andromeda-by-sweeterman",
  },
  {
    id: "dance-floor",
    title: "Dance Floor",
    artist: "livelikedavis",
    url: "https://soundcloud.com/livelikedavis/dance-floor",
  },
  {
    id: "weiland-going-out-demo",
    title: "Weiland Going Out Demo",
    artist: "sphinx28",
    url: "https://soundcloud.com/sphinx28/weiland-going-out-demo",
  },
  {
    id: "ovo-sound-radio-episode-19",
    title: "OVO Sound Radio Episode 19",
    artist: "what-is-this-link-anyway",
    url: "https://soundcloud.com/what-is-this-link-anyway/ovo-sound-radio-episode-19",
  },
  {
    id: "lil-yachty-cortex",
    title: "Lil Yachty Cortex",
    artist: "jrproper",
    url: "https://soundcloud.com/jrproper/lil-yachty-cortex",
  },
  {
    id: "west-war",
    title: "West War",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/west-war",
  },
  {
    id: "erykah-badu-on-soleil-camara-flip-2021",
    title: "Erykah Badu On Soleil Camara Flip 2021",
    artist: "soleilcamara",
    url: "https://soundcloud.com/soleilcamara/erykah-badu-on-soleil-camara-flip-2021",
  },
  {
    id: "a-boogie-wit-da-hoodie-this-1",
    title: "A Boogie Wit Da Hoodie This 1",
    artist: "mya-perez-909487479",
    url: "https://soundcloud.com/mya-perez-909487479/a-boogie-wit-da-hoodie-this-1",
  },
  {
    id: "baby-keem-orange-soda-sjayy-official-remix",
    title: "Baby Keem Orange Soda Sjayy Official Remix",
    artist: "sjayyofficial",
    url: "https://soundcloud.com/sjayyofficial/baby-keem-orange-soda-sjayy-official-remix",
  },
  {
    id: "jarrad-cleofe-bankrolls-lak7-ep04",
    title: "Jarrad Cleofe Bankrolls Lak7 EP04",
    artist: "checklak7",
    url: "https://soundcloud.com/checklak7/jarrad-cleofe-bankrolls-lak7-ep04",
  },
  {
    id: "just-blaze-sinjin-hawke-one",
    title: "Just Blaze Sinjin Hawke One",
    artist: "sinjin_hawke",
    url: "https://soundcloud.com/sinjin_hawke/just-blaze-sinjin-hawke-one",
  },
  {
    id: "yea-hoe",
    title: "Yea Hoe",
    artist: "sinjin_hawke",
    url: "https://soundcloud.com/sinjin_hawke/yea-hoe",
  },
  {
    id: "islabert",
    title: "Islabert",
    artist: "bakedgood",
    url: "https://soundcloud.com/bakedgood/islabert",
  },
  {
    id: "the-good-1",
    title: "The Good 1",
    artist: "senai-sounds",
    url: "https://soundcloud.com/senai-sounds/the-good-1",
  },
  {
    id: "michael-jackson-beat-it-remix-lld",
    title: "Michael Jackson Beat It Remix LLD",
    artist: "livelikedavis",
    url: "https://soundcloud.com/livelikedavis/michael-jackson-beat-it-remix-lld",
  },
  {
    id: "hurricane-pt-2",
    title: "Hurricane Pt 2",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/hurricane-pt-2",
  },
  {
    id: "kanye-west-awesome-original-pitch",
    title: "Kanye West Awesome Original Pitch",
    artist: "charliewyatt5",
    url: "https://soundcloud.com/charliewyatt5/kanye-west-awesome-original-pitch",
  },
  {
    id: "dustin-paik-paradise-ny-at-the-brooklyn-mirage",
    title: "Dustin Paik Paradise NY At The Brooklyn Mirage",
    artist: "dustinpaik",
    url: "https://soundcloud.com/dustinpaik/dustin-paik-paradise-ny-at-the-brooklyn-mirage",
  },
  {
    id: "mamas-boyfriend-kanye-west-1",
    title: "Mamas Boyfriend Kanye West 1",
    artist: "yo-boi-lester",
    url: "https://soundcloud.com/yo-boi-lester/mamas-boyfriend-kanye-west-1",
  },
  {
    id: "gab3-x-lil-peep-hollywood-dreaming-prod-by-money-posse",
    title: "Gab3 X Lil Peep Hollywood Dreaming Prod By Money Posse",
    artist: "gab3omg",
    url: "https://soundcloud.com/gab3omg/gab3-x-lil-peep-hollywood-dreaming-prod-by-money-posse",
  },
  {
    id: "none-of-it-prod-bam-bam",
    title: "None Of It Prod Bam Bam",
    artist: "uptownchavo",
    url: "https://soundcloud.com/uptownchavo/none-of-it-prod-bam-bam",
  },
  {
    id: "yesladyyy-1",
    title: "Yesladyyy 1",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/yesladyyy-1",
  },
  {
    id: "never-leave-you-rashad-rawkus-drogba-jonanna-edit-mp3",
    title: "Never Leave You Rashad Rawkus Drogba Jonanna Edit MP3",
    artist: "rashadrawkus",
    url: "https://soundcloud.com/rashadrawkus/never-leave-you-rashad-rawkus-drogba-jonanna-edit-mp3",
  },
  {
    id: "lord-pretty-bad-gal-jodye",
    title: "Lord Pretty Bad Gal Jodye",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/lord-pretty-bad-gal-jodye",
  },
  {
    id: "how-it-be",
    title: "How It Be",
    artist: "pierrebourne",
    url: "https://soundcloud.com/pierrebourne/how-it-be",
  },
  {
    id: "how-2-luv",
    title: "How 2 Luv",
    artist: "beldina",
    url: "https://soundcloud.com/beldina/how-2-luv",
  },
  {
    id: "atl-freestyle-1",
    title: "ATL Freestyle 1",
    artist: "snowmanservin",
    url: "https://soundcloud.com/snowmanservin/atl-freestyle-1",
  },
  {
    id: "454-fast-trax",
    title: "454 Fast Trax",
    artist: "user-247074481",
    url: "https://soundcloud.com/user-247074481/454-fast-trax",
  },
  {
    id: "travis-scott-analogue",
    title: "Travis Scott Analogue",
    artist: "user-809721490",
    url: "https://soundcloud.com/user-809721490/travis-scott-analogue",
  },
  {
    id: "xhu-trap-tt4l-prod-pierre-1",
    title: "Xhu Trap TT4L Prod Pierre 1",
    artist: "xhulooo",
    url: "https://soundcloud.com/xhulooo/xhu-trap-tt4l-prod-pierre-1",
  },
  {
    id: "chance-feat-sofaygo",
    title: "Chance Feat Sofaygo",
    artist: "ssgko",
    url: "https://soundcloud.com/ssgko/chance-feat-sofaygo",
  },
  {
    id: "money-in-the-grave-jbroadway-remix",
    title: "Money In The Grave JBroadway Remix",
    artist: "jbroadwaymusic",
    url: "https://soundcloud.com/jbroadwaymusic/money-in-the-grave-jbroadway-remix",
  },
  {
    id: "cheers-mate",
    title: "Cheers Mate",
    artist: "a-k-paul",
    url: "https://soundcloud.com/a-k-paul/cheers-mate",
  },
  {
    id: "skateboard-p-mix-prod-by-elijah-who",
    title: "Skateboard P Mix Prod By Elijah Who",
    artist: "theprivateclub-382844997",
    url: "https://soundcloud.com/theprivateclub-382844997/skateboard-p-mix-prod-by-elijah-who",
  },
  {
    id: "yeye-prodpharoah",
    title: "Yeye Prodpharoah",
    artist: "user-409102805",
    url: "https://soundcloud.com/user-409102805/yeye-prodpharoah",
  },
  {
    id: "playboi-carti-switching-lanes",
    title: "Playboi Carti Switching Lanes",
    artist: "user-113418145",
    url: "https://soundcloud.com/user-113418145/playboi-carti-switching-lanes",
  },
  {
    id: "aap-rocky-distraction",
    title: "AAP Rocky Distraction",
    artist: "americanalovesyou",
    url: "https://soundcloud.com/americanalovesyou/aap-rocky-distraction",
  },
  {
    id: "infinity",
    title: "Infinity",
    artist: "matt_ox",
    url: "https://soundcloud.com/matt_ox/infinity",
  },
  {
    id: "bleed",
    title: "Bleed",
    artist: "newyearsplace",
    url: "https://soundcloud.com/newyearsplace/bleed",
  },
  {
    id: "sideways",
    title: "Sideways",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/sideways",
  },
  {
    id: "slide-on-me",
    title: "Slide On Me",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/slide-on-me",
  },
  {
    id: "stuck-ft-lil-yachty",
    title: "Stuck Ft Lil Yachty",
    artist: "kencarson",
    url: "https://soundcloud.com/kencarson/stuck-ft-lil-yachty",
  },
  {
    id: "aap-yams-x-blaccmass-60-minute-expo",
    title: "AAP Yams X Blaccmass 60 Minute Expo",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/aap-yams-x-blaccmass-60-minute-expo",
  },
  {
    id: "sosstapes-vol-1",
    title: "SOS Tapes Vol 1",
    artist: "tlop444",
    url: "https://soundcloud.com/tlop444/sosstapes-vol-1",
  },
  {
    id: "u-n-i-t-y",
    title: "U N I T Y",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/u-n-i-t-y",
  },
  {
    id: "gucci-mane-im-da-shit-wampire",
    title: "Gucci Mane Im Da Shit Wampire",
    artist: "starfucker_usa",
    url: "https://soundcloud.com/starfucker_usa/gucci-mane-im-da-shit-wampire",
  },
  {
    id: "mario-judah-bean-lean",
    title: "Mario Judah Bean Lean",
    artist: "mario-judah",
    url: "https://soundcloud.com/mario-judah/mario-judah-bean-lean",
  },
  {
    id: "thinkin-to-myself-prod-psoul",
    title: "Thinkin To Myself Prod Psoul",
    artist: "madeintyo",
    url: "https://soundcloud.com/madeintyo/thinkin-to-myself-prod-psoul",
  },
  {
    id: "jam-with-brie",
    title: "Jam With Brie",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/jam-with-brie",
  },
  {
    id: "get-down-feat-oncue",
    title: "Get Down Feat OnCue",
    artist: "chriswebby",
    url: "https://soundcloud.com/chriswebby/get-down-feat-oncue",
  },
  {
    id: "the-good-the-bad-the-ugly",
    title: "The Good The Bad The Ugly",
    artist: "kanyesfreshmanadjustments",
    url: "https://soundcloud.com/kanyesfreshmanadjustments/the-good-the-bad-the-ugly",
  },
  {
    id: "nina-chop",
    title: "Nina Chop",
    artist: "lowkeysus23",
    url: "https://soundcloud.com/lowkeysus23/nina-chop",
  },
  {
    id: "dennis-hook-me-up-with-some",
    title: "Dennis Hook Me Up With Some",
    artist: "dp16",
    url: "https://soundcloud.com/dp16/dennis-hook-me-up-with-some",
  },
  {
    id: "pierre-megamix-vol-1",
    title: "Pierre Megamix Vol 1",
    artist: "tlop444",
    url: "https://soundcloud.com/tlop444/pierre-megamix-vol-1",
  },
  {
    id: "don-toliver-x-nav-recap-drillmix",
    title: "Don Toliver X Nav Recap Drillmix",
    artist: "soldadoaudio",
    url: "https://soundcloud.com/soldadoaudio/don-toliver-x-nav-recap-drillmix",
  },
  {
    id: "ilovemakonnen-down-4-so-long-remix-ft-ezra-koenig-despot",
    title: "ILoveMakonnen Down 4 So Long Remix Ft Ezra Koenig Despot",
    artist: "thomas-nantes",
    url: "https://soundcloud.com/thomas-nantes/ilovemakonnen-down-4-so-long-remix-ft-ezra-koenig-despot",
  },
  {
    id: "depends-prod-madeintyo",
    title: "Depends Prod MadeinTYO",
    artist: "madeintyo",
    url: "https://soundcloud.com/madeintyo/depends-prod-madeintyo",
  },
  {
    id: "3-eminem-its-ok",
    title: "3 Eminem Its Ok",
    artist: "dani-sleeuwits",
    url: "https://soundcloud.com/dani-sleeuwits/3-eminem-its-ok",
  },
  {
    id: "christian-dior-denim-flow-kanye-west",
    title: "Christian Dior Denim Flow Kanye West",
    artist: "fdrny",
    url: "https://soundcloud.com/fdrny/christian-dior-denim-flow-kanye-west",
  },
  {
    id: "drake-you-know-you-know-prod-by-kanye-west",
    title: "Drake You Know You Know Prod By Kanye West",
    artist: "mr32_0",
    url: "https://soundcloud.com/mr32_0/drake-you-know-you-know-prod-by-kanye-west",
  },
  {
    id: "rolling-inthe-deep-ft-1",
    title: "Rolling In The Deep Ft 1",
    artist: "forever-childish2",
    url: "https://soundcloud.com/forever-childish2/rolling-inthe-deep-ft-1",
  },
  {
    id: "j-cole-louis-vuitton",
    title: "J Cole Louis Vuitton",
    artist: "eating-hip-hop",
    url: "https://soundcloud.com/eating-hip-hop/j-cole-louis-vuitton",
  },
  {
    id: "caffeine-vitamins",
    title: "Caffeine Vitamins",
    artist: "griffin-mcmahon",
    url: "https://soundcloud.com/griffin-mcmahon/caffeine-vitamins",
  },
  {
    id: "ily-1",
    title: "ILY 1",
    artist: "beldina",
    url: "https://soundcloud.com/beldina/ily-1",
  },
  {
    id: "molly-world",
    title: "Molly World",
    artist: "vaughnpm",
    url: "https://soundcloud.com/vaughnpm/molly-world",
  },
  {
    id: "5-bearbrick",
    title: "5 Bearbrick",
    artist: "pierrebourne",
    url: "https://soundcloud.com/pierrebourne/5-bearbrick",
  },
  {
    id: "kelly-k-playboi-carti-og-version",
    title: "Kelly K Playboi Carti OG Version",
    artist: "user-507721525-322786251",
    url: "https://soundcloud.com/user-507721525-322786251/kelly-k-playboi-carti-og-version",
  },
  {
    id: "kim-k-by-sweeterman",
    title: "Kim K By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/kim-k-by-sweeterman",
  },
  {
    id: "act-1-eternal-sunshine-the-pledgeby-jay-electronica",
    title: "Act 1 Eternal Sunshine The Pledge By Jay Electronica",
    artist: "erykah-she-ill-badu",
    url: "https://soundcloud.com/erykah-she-ill-badu/act-1-eternal-sunshine-the-pledgeby-jay-electronica",
  },
  {
    id: "smash",
    title: "Smash",
    artist: "vaughnpm",
    url: "https://soundcloud.com/vaughnpm/smash",
  },
  {
    id: "lil-wayne-kobe-bryant",
    title: "Lil Wayne Kobe Bryant",
    artist: "akajoe",
    url: "https://soundcloud.com/akajoe/lil-wayne-kobe-bryant",
  },
  {
    id: "7-03-no-quitter-go-getter",
    title: "7 03 No Quitter Go Getter",
    artist: "jason24do",
    url: "https://soundcloud.com/jason24do/7-03-no-quitter-go-getter",
  },
  {
    id: "aboogie-dtb",
    title: "A Boogie DTB",
    artist: "anthony-eliopoulos",
    url: "https://soundcloud.com/anthony-eliopoulos/aboogie-dtb",
  },
  {
    id: "daft-punk-jay-z-computerized",
    title: "Daft Punk Jay Z Computerized",
    artist: "karterfutur",
    url: "https://soundcloud.com/karterfutur/daft-punk-jay-z-computerized",
  },
  {
    id: "raindrop-droptop",
    title: "Raindrop Droptop",
    artist: "montebooker",
    url: "https://soundcloud.com/montebooker/raindrop-droptop",
  },
  {
    id: "hassi-case-closed-produced-by-louie-crack-simmy-auto",
    title: "Hassi Case Closed Produced By Louie Crack Simmy Auto",
    artist: "hassirv",
    url: "https://soundcloud.com/hassirv/hassi-case-closed-produced-by-louie-crack-simmy-auto",
  },
  {
    id: "pharrell-dj-drama-in-my-mind-prequel-2006-shit",
    title: "Pharrell DJ Drama In My Mind Prequel 2006 Shit",
    artist: "elriohippie",
    url: "https://soundcloud.com/elriohippie/pharrell-dj-drama-in-my-mind-prequel-2006-shit",
  },
  {
    id: "looking-for-love-womack-rework-fat-larrys-band",
    title: "Looking For Love Womack Rework Fat Larrys Band",
    artist: "womackreworks",
    url: "https://soundcloud.com/womackreworks/looking-for-love-womack-rework-fat-larrys-band",
  },
  {
    id: "pierre-bourne-my-bitch",
    title: "Pierre Bourne My Bitch",
    artist: "user-679825602",
    url: "https://soundcloud.com/user-679825602/pierre-bourne-my-bitch",
  },
  {
    id: "madeintyo-uber-everywhere-scheffy-remix",
    title: "MadeinTYO Uber Everywhere Scheffy Remix",
    artist: "user-417184272",
    url: "https://soundcloud.com/user-417184272/madeintyo-uber-everywhere-scheffy-remix",
  },
  {
    id: "childish-gambino-terrified-zikomo-remix",
    title: "Childish Gambino Terrified Zikomo Remix",
    artist: "zikomo",
    url: "https://soundcloud.com/zikomo/childish-gambino-terrified-zikomo-remix",
  },
  {
    id: "trap-vacant",
    title: "Trap Vacant",
    artist: "frazier-trill",
    url: "https://soundcloud.com/frazier-trill/trap-vacant",
  },
  {
    id: "3-fiji",
    title: "3 Fiji",
    artist: "pierrebourne",
    url: "https://soundcloud.com/pierrebourne/3-fiji",
  },
  {
    id: "whats-the-move-with-brie",
    title: "Whats The Move With Brie",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/whats-the-move-with-brie",
  },
  {
    id: "escondido-x-badco",
    title: "Escondido X Badco",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/escondido-x-badco",
  },
  {
    id: "cant-look-in-my-eyes-feat-kid-cudi",
    title: "Cant Look In My Eyes Feat Kid Cudi",
    artist: "cqcxof",
    url: "https://soundcloud.com/cqcxof/cant-look-in-my-eyes-feat-kid-cudi",
  },
  {
    id: "kanye-west-when-i-see-it-tell-your-friends-remix",
    title: "Kanye West When I See It Tell Your Friends Remix",
    artist: "kanye-west-collective",
    url: "https://soundcloud.com/kanye-west-collective/kanye-west-when-i-see-it-tell-your-friends-remix",
  },
  {
    id: "young-thug-givenchy-rich-gang",
    title: "Young Thug Givenchy Rich Gang",
    artist: "amance-hermes-viossi",
    url: "https://soundcloud.com/amance-hermes-viossi/young-thug-givenchy-rich-gang",
  },
  {
    id: "fake-as-hell",
    title: "Fake As Hell",
    artist: "pierrebourne",
    url: "https://soundcloud.com/pierrebourne/fake-as-hell",
  },
  {
    id: "drake-sweeterman-explicit",
    title: "Drake Sweeterman Explicit",
    artist: "chargedupdrake",
    url: "https://soundcloud.com/chargedupdrake/drake-sweeterman-explicit",
  },
  {
    id: "vsvsvs1",
    title: "VSVSVS1",
    artist: "2fourhrs",
    url: "https://soundcloud.com/2fourhrs/vsvsvs1",
  },
  {
    id: "drake-freak-in-you-partynextdoor-remix",
    title: "Drake Freak In You Partynextdoor Remix",
    artist: "datheat",
    url: "https://soundcloud.com/datheat/drake-freak-in-you-partynextdoor-remix",
  },
  {
    id: "tristan-thompson",
    title: "Tristan Thompson",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/tristan-thompson",
  },
  {
    id: "cantlookintomyeyes",
    title: "Cant Look Into My Eyes",
    artist: "synesthesiasoundz",
    url: "https://soundcloud.com/synesthesiasoundz/cantlookintomyeyes",
  },
  {
    id: "ftsv1latenightsnacc",
    title: "FTSV1 Late Night Snacc",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/ftsv1latenightsnacc",
  },
  {
    id: "ftsv1dinner",
    title: "FTSV1 Dinner",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/ftsv1dinner",
  },
  {
    id: "ftsv1breakfast",
    title: "FTSV1 Breakfast",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/ftsv1breakfast",
  },
  {
    id: "tonights",
    title: "Tonights",
    artist: "theshipwrek",
    url: "https://soundcloud.com/theshipwrek/tonights",
  },
  {
    id: "young-thug-elton-likes-me",
    title: "Young Thug Elton Likes Me",
    artist: "sabsad",
    url: "https://soundcloud.com/sabsad/young-thug-elton-likes-me",
  },
]

export default function EasterEgg() {
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [velocity, setVelocity] = useState({ x: 2, y: 2 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const animationRef = useRef<number | null>(null)

  // Movement animation
  useEffect(() => {
    if (isModalOpen) return // Pause movement when modal is open

    const animate = () => {
      setPosition((prev) => {
        let newX = prev.x + velocity.x
        let newY = prev.y + velocity.y
        let newVelX = velocity.x
        let newVelY = velocity.y

        // Bounce off walls
        if (newX <= 0 || newX >= window.innerWidth - 50) {
          newVelX = -velocity.x
          newX = newX <= 0 ? 0 : window.innerWidth - 50
        }
        if (newY <= 0 || newY >= window.innerHeight - 50) {
          newVelY = -velocity.y
          newY = newY <= 0 ? 0 : window.innerHeight - 50
        }

        setVelocity({ x: newVelX, y: newVelY })
        return { x: newX, y: newY }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [velocity, isModalOpen])

  // Load random track
  const loadRandomTrack = async () => {
    if (SOUNDCLOUD_LIKES.length === 0) {
      console.warn("No tracks available")
      return
    }

    setIsLoading(true)

    // Add slight delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Get random track, avoiding immediate repeats
    let randomTrack = SOUNDCLOUD_LIKES[Math.floor(Math.random() * SOUNDCLOUD_LIKES.length)]
    if (currentTrack && SOUNDCLOUD_LIKES.length > 1) {
      while (randomTrack.id === currentTrack.id) {
        randomTrack = SOUNDCLOUD_LIKES[Math.floor(Math.random() * SOUNDCLOUD_LIKES.length)]
      }
    }

    setCurrentTrack(randomTrack)
    setIsLoading(false)
  }

  // Handle icon click
  const handleClick = () => {
    setIsModalOpen(true)
    loadRandomTrack()
  }

  // Shuffle to new track
  const shuffleTrack = () => {
    loadRandomTrack()
  }

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false)
      }
    }

    if (isModalOpen) {
      window.addEventListener("keydown", handleEsc)
      return () => window.removeEventListener("keydown", handleEsc)
    }
  }, [isModalOpen])

  return (
    <>
      {/* Moving Yellow Mario Question Mark */}
      <div
        className="mario-box absolute transition-all duration-1000 cursor-pointer z-40"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {/* SoundCloud Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

          {/* Modal Content */}
          <div className="relative w-full max-w-2xl bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Music className="w-6 h-6 text-cyan-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">Discovery Mode</h2>
                  <p className="text-xs text-gray-400">
                    {SOUNDCLOUD_LIKES.length} tracks from @djsweeterman's collection
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Track Info & Controls */}
            {currentTrack && !isLoading && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{currentTrack.title}</h3>
                    <p className="text-sm text-gray-400">{currentTrack.artist}</p>
                  </div>

                  <button
                    onClick={shuffleTrack}
                    disabled={SOUNDCLOUD_LIKES.length <= 1}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-cyan-500/30"
                  >
                    <Shuffle className="w-4 h-4" />
                    Next Track
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="p-12 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
                <p className="text-gray-400">Loading track...</p>
              </div>
            )}

            {/* SoundCloud Embed */}
            {currentTrack && !isLoading && (
              <div className="relative w-full h-[400px] bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  scrolling="no"
                  frameBorder="no"
                  allow="autoplay"
                  src={currentTrack.url}
                  className="absolute inset-0"
                />
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/50">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Press ESC to close • Click outside to dismiss</span>
                <a
                  href={currentTrack?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  View on SoundCloud →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
