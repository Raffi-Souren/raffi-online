"use client"
import { useState, useEffect, useRef } from "react"
import { Shuffle, X } from "lucide-react"

type Track = {
  id: string
  url: string
  title: string
  artist: string
}

const SOUNDCLOUD_TRACKS: Track[] = [
  {
    id: "yukon-x-up-dj-hunny-bee-remix",
    title: "Yukon X Up (DJ Hunny Bee Remix)",
    artist: "djhunnybee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-remix",
  },
  {
    id: "four-tet-insect-near-piha-beach",
    title: "Insect Near Piha Beach",
    artist: "user-982065028",
    url: "https://soundcloud.com/user-982065028/four-tet-insect-near-piha-beach",
  },
  {
    id: "habibi-funk-beirut",
    title: "Habibi Funk Beirut",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-beirut",
  },
  {
    id: "chopsuey",
    title: "Chop Suey",
    artist: "osive",
    url: "https://soundcloud.com/osive/chopsuey",
  },
  {
    id: "gordos-dilemma",
    title: "Gordo's Dilemma",
    artist: "gordoszn",
    url: "https://soundcloud.com/gordoszn/gordos-dilemma",
  },
  {
    id: "08-compton-state-of-mind",
    title: "Compton State of Mind",
    artist: "miles-davis-29",
    url: "https://soundcloud.com/miles-davis-29/08-compton-state-of-mind",
  },
  {
    id: "fidde-i-wonder-yuno-hu-vision",
    title: "I Wonder (Yuno Hu Vision)",
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
    title: "Dipset x Future - I Really Mean",
    artist: "sangobeats",
    url: "https://soundcloud.com/sangobeats/dipset-x-future-i-really-mean",
  },
  {
    id: "mos-def-auditorium-2",
    title: "Mos Def - Auditorium",
    artist: "beaubouthillier-1",
    url: "https://soundcloud.com/beaubouthillier-1/mos-def-auditorium-2",
  },
  {
    id: "blemforreal",
    title: "Blem For Real",
    artist: "davidmackaymusic",
    url: "https://soundcloud.com/davidmackaymusic/blemforreal",
  },
  {
    id: "tems-me-u-blk-remix",
    title: "Tems - Me & U (BLK Remix)",
    artist: "blkmvsic",
    url: "https://soundcloud.com/blkmvsic/tems-me-u-blk-remix",
  },
  {
    id: "first-day-of-my-life-bright",
    title: "First Day of My Life",
    artist: "larryfisherman",
    url: "https://soundcloud.com/larryfisherman/first-day-of-my-life-bright",
  },
  {
    id: "phoenix-1",
    title: "Phoenix",
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
    title: "Casts of a Dreamer (Full Tape)",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/casts-of-a-dreamer-full-tape",
  },
  {
    id: "gordo-x-drake-healing-my-pal-al-remix-1",
    title: "Gordo x Drake - Healing (My Pal Al Remix)",
    artist: "mypalalmusic",
    url: "https://soundcloud.com/mypalalmusic/gordo-x-drake-healing-my-pal-al-remix-1",
  },
  {
    id: "sade-sweetest-taboo-november-rose-amapiano-remix",
    title: "Sade - Sweetest Taboo (November Rose Amapiano Remix)",
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
    id: "mitsubishi-sony",
    title: "Mitsubishi Sony",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/mitsubishi-sony",
  },
  {
    id: "gilga-01-childish-gambino-1",
    title: "Gilga - Childish Gambino",
    artist: "david-nelson-494707975",
    url: "https://soundcloud.com/david-nelson-494707975/gilga-01-childish-gambino-1",
  },
  {
    id: "partynextdoor-showing-you-baile-baile-funk-edit",
    title: "PARTYNEXTDOOR - Showing You (Baile Funk Edit)",
    artist: "ang-official",
    url: "https://soundcloud.com/ang-official/partynextdoor-showing-you-baile-baile-funk-edit",
  },
  {
    id: "beyonce-end-of-time-sydney-sousa-baile-funk-edit",
    title: "Beyonce - End Of Time (Sydney Sousa Baile Funk Edit)",
    artist: "dj-sydney-sousa",
    url: "https://soundcloud.com/dj-sydney-sousa/beyonce-end-of-time-sydney-sousa-baile-funk-edit",
  },
  {
    id: "peggy-gou-it-goes-like-nanana-baile-funk-edit",
    title: "Peggy Gou - It Goes Like Nanana (Baile Funk Edit)",
    artist: "caiohot",
    url: "https://soundcloud.com/caiohot/peggy-gou-it-goes-like-nanana-baile-funk-edit",
  },
  {
    id: "sango-amor-di-american-loverboy",
    title: "Sango - Amor Di American Loverboy",
    artist: "manlikesirene",
    url: "https://soundcloud.com/manlikesirene/sango-amor-di-american-loverboy",
  },
  {
    id: "bitch-dont-kill-my-funk-b",
    title: "Bitch Don't Kill My Funk",
    artist: "b_smileloco98",
    url: "https://soundcloud.com/b_smileloco98/bitch-dont-kill-my-funk-b",
  },
  {
    id: "chamber-of-reflection-brazilian-funk-remix",
    title: "Chamber of Reflection (Brazilian Funk Remix)",
    artist: "user-167742358",
    url: "https://soundcloud.com/user-167742358/chamber-of-reflection-brazilian-funk-remix",
  },
  {
    id: "fisherrr-shekdash-remix",
    title: "Fisherrr (Shekdash Remix)",
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
    title: "Rich Baby Daddy (Pherris Edit A-Side)",
    artist: "pherrismusic",
    url: "https://soundcloud.com/pherrismusic/rich-baby-daddy-pherris-edit-a-side",
  },
  {
    id: "lose-my-breath-yanghi-amapiano-edit",
    title: "Lose My Breath (Yanghi Amapiano Edit)",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/lose-my-breath-yanghi-amapiano-edit",
  },
  {
    id: "kanye-west-i-wonder-yanghi-amapiano-edit-free-dl-1",
    title: "Kanye West - I Wonder (Yanghi Amapiano Edit)",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/kanye-west-i-wonder-yanghi-amapiano-edit-free-dl-1",
  },
  {
    id: "gunna-fukumean-yanghi-baile-edit",
    title: "Gunna - Fukumean (Yanghi Baile Edit)",
    artist: "giovaneyanghi",
    url: "https://soundcloud.com/giovaneyanghi/gunna-fukumean-yanghi-baile-edit",
  },
  {
    id: "4batz-act-ii-bailefunk-adr",
    title: "4batz - Act II (Bailefunk ADR)",
    artist: "alldayrayatx",
    url: "https://soundcloud.com/alldayrayatx/4batz-act-ii-bailefunk-adr",
  },
  {
    id: "4batzqulianoedit",
    title: "4batz (Quliano Edit)",
    artist: "qulianomusic",
    url: "https://soundcloud.com/qulianomusic/4batzqulianoedit",
  },
  {
    id: "another-you-feat-tony-williams",
    title: "Another You (feat. Tony Williams)",
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
    title: "Not Over (Prod. Kaytranada)",
    artist: "kaycyypluto",
    url: "https://soundcloud.com/kaycyypluto/not-over-prod-kaytranada",
  },
  {
    id: "ill-b-late-fa-dat-1",
    title: "I'll B Late Fa Dat",
    artist: "soundsofadream",
    url: "https://soundcloud.com/soundsofadream/ill-b-late-fa-dat-1",
  },
  {
    id: "cirez-d-marquee-las-vegas-2017-id",
    title: "Cirez D - Marquee Las Vegas 2017 ID",
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
    title: "Liability (Sahara Remix)",
    artist: "saharabeats",
    url: "https://soundcloud.com/saharabeats/liability-sahara-remix",
  },
  {
    id: "tay-k-pain-1993-kd-remix",
    title: "Tay K - Pain (1993 KD Remix)",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/tay-k-pain-1993-kd-remix",
  },
  {
    id: "brent-faiyaz-jackie-brown",
    title: "Brent Faiyaz - Jackie Brown",
    artist: "ekany",
    url: "https://soundcloud.com/ekany/brent-faiyaz-jackie-brown",
  },
  {
    id: "drake-jaded-ekany-amapiano-remix",
    title: "Drake - Jaded (Ekany Amapiano Remix)",
    artist: "ekany",
    url: "https://soundcloud.com/ekany/drake-jaded-ekany-amapiano-remix",
  },
  {
    id: "massano-the-blaze",
    title: "Massano - The Blaze",
    artist: "massanomusic",
    url: "https://soundcloud.com/massanomusic/massano-the-blaze",
  },
  {
    id: "kanye-west-lost-in-the-world-arpiar-edit-krasse-tone-remix-2",
    title: "Kanye West - Lost In The World (Arpiar Edit Krasse Tone Remix)",
    artist: "adil-cirak",
    url: "https://soundcloud.com/adil-cirak/kanye-west-lost-in-the-world-arpiar-edit-krasse-tone-remix-2",
  },
  {
    id: "playboi-carti-gunna-ysl-x-crush-on-you-kd-mix",
    title: "Playboi Carti & Gunna - YSL x Crush On You (KD Mix)",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/playboi-carti-gunna-ysl-x-crush-on-you-kd-mix",
  },
  {
    id: "dave-central-cee-sprinter-govi-remix",
    title: "Dave & Central Cee - Sprinter (Govi Remix)",
    artist: "govibeats",
    url: "https://soundcloud.com/govibeats/dave-central-cee-sprinter-govi-remix",
  },
  {
    id: "jit-wit-da-wicks-prod-454",
    title: "Jit Wit Da Wicks (Prod. 454)",
    artist: "454spike",
    url: "https://soundcloud.com/454spike/jit-wit-da-wicks-prod-454",
  },
  {
    id: "science-class-westside-gunn",
    title: "Science Class - Westside Gunn",
    artist: "user-230513036",
    url: "https://soundcloud.com/user-230513036/science-class-westside-gunn",
  },
  {
    id: "frank-ocean-new-music-from-blonded-xmas-episode",
    title: "Frank Ocean - New Music from Blonded Xmas Episode",
    artist: "blondedprovider",
    url: "https://soundcloud.com/blondedprovider/frank-ocean-new-music-from-blonded-xmas-episode",
  },
  {
    id: "frank-ocean-white-ferrari-2023-coachella-version-remake-2",
    title: "Frank Ocean - White Ferrari (2023 Coachella Version Remake)",
    artist: "jxckstxlly",
    url: "https://soundcloud.com/jxckstxlly/frank-ocean-white-ferrari-2023-coachella-version-remake-2",
  },
  {
    id: "dear-april-justice-remix",
    title: "Dear April (Justice Remix)",
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
    title: "Hot in Circo Loco",
    artist: "user-290523936",
    url: "https://soundcloud.com/user-290523936/hot-in-circo-loco",
  },
  {
    id: "kdot-x-radiohead",
    title: "Kdot x Radiohead",
    artist: "dwellsnyc",
    url: "https://soundcloud.com/dwellsnyc/kdot-x-radiohead",
  },
  {
    id: "mac-miller-x-mf-doom-happy-doomsday-kd-mix",
    title: "Mac Miller x MF DOOM - Happy Doomsday (KD Mix)",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/mac-miller-x-mf-doom-happy-doomsday-kd-mix",
  },
  {
    id: "beyonce-x-stardust-break-my-soul-sango-mix",
    title: "Beyonce x Stardust - Break My Soul (Sango Mix)",
    artist: "sangobeats",
    url: "https://soundcloud.com/sangobeats/beyonce-x-stardust-break-my-soul-sango-mix",
  },
  {
    id: "quavo-without-you",
    title: "Without You",
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
    title: "Keinemusik Radio Show by Reznik",
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
    title: "Novacane - Frank Ocean (Jun Tanaka Edit)",
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
    title: "MLK (feat. Trouble & Shad Da God)",
    artist: "youngthugworld",
    url: "https://soundcloud.com/youngthugworld/mlk-feat-trouble-shad-da-god",
  },
  {
    id: "shawny-binladen-yellowtears",
    title: "Shawny Binladen - Yellowtears",
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
    title: "Brent Faiyaz - All Mine (Dwells RMX)",
    artist: "dwellsnyc",
    url: "https://soundcloud.com/dwellsnyc/brent-faiyaz-all-mine-dwells-rmx",
  },
  {
    id: "asap-rocky-x-dr-gabba-mixed-by-kd_muzak",
    title: "ASAP Rocky x Dr. Gabba (Mixed by KD_Muzak)",
    artist: "user988416882",
    url: "https://soundcloud.com/user988416882/asap-rocky-x-dr-gabba-mixed-by-kd_muzak",
  },
  {
    id: "wale-ft-j-cole-winter-schemes",
    title: "Wale ft. J. Cole - Winter Schemes",
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
    title: "Central Cee - Doja (Cmano Remix)",
    artist: "cmano",
    url: "https://soundcloud.com/cmano/central-cee-doja-cmano-remix",
  },
  {
    id: "other-shit-playboi-carti-josh",
    title: "Other Shit - Playboi Carti",
    artist: "josh-christian-532114961l",
    url: "https://soundcloud.com/josh-christian-532114961l/other-shit-playboi-carti-josh",
  },
  {
    id: "praise-the-lord-durdenhauer-edit",
    title: "Praise The Lord (Durdenhauer Edit)",
    artist: "durdenhauer",
    url: "https://soundcloud.com/durdenhauer/praise-the-lord-durdenhauer-edit",
  },
  {
    id: "drake-a-keeper-open-till-l8-remix",
    title: "Drake - A Keeper (Open Till L8 Remix)",
    artist: "opentilll8",
    url: "https://soundcloud.com/opentilll8/drake-a-keeper-open-till-l8-remix",
  },
  {
    id: "track-9-1",
    title: "Track 9",
    artist: "skepta",
    url: "https://soundcloud.com/skepta/track-9-1",
  },
  {
    id: "flex-up-prod-by-maaly-raw",
    title: "Flex Up (Prod. by Maaly Raw)",
    artist: "liluzivert",
    url: "https://soundcloud.com/liluzivert/flex-up-prod-by-maaly-raw",
  },
  {
    id: "glock-in-my-purse-prod-by-mustard",
    title: "Glock In My Purse (Prod. by Mustard)",
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
    title: "Drake - Sticky (Zack Bia Remix)",
    artist: "zackbia",
    url: "https://soundcloud.com/zackbia/drake-sticky-zack-bia-remix",
  },
  {
    id: "jeff-mills-changes-of-life",
    title: "Jeff Mills - Changes of Life",
    artist: "discofanatic",
    url: "https://soundcloud.com/discofanatic/jeff-mills-changes-of-life",
  },
  {
    id: "cirez-d-on-off-pryda-remix",
    title: "Cirez D - On Off (Pryda Remix)",
    artist: "gustav-granath",
    url: "https://soundcloud.com/gustav-granath/cirez-d-on-off-pryda-remix",
  },
  {
    id: "cut-her-off-pierre-bourne",
    title: "Cut Her Off - Pierre Bourne",
    artist: "202-exclusive",
    url: "https://soundcloud.com/202-exclusive/cut-her-off-pierre-bourne",
  },
  {
    id: "kendrick-lamar-n95-never-dull-remix",
    title: "Kendrick Lamar - N95 (Never Dull Remix)",
    artist: "neverdullmusic",
    url: "https://soundcloud.com/neverdullmusic/kendrick-lamar-n95-never-dull-remix",
  },
  {
    id: "idris-muhammad-could-heaven-ever-be-like-this-house-remix",
    title: "Idris Muhammad - Could Heaven Ever Be Like This (House Remix)",
    artist: "julas-beats",
    url: "https://soundcloud.com/julas-beats/idris-muhammad-could-heaven-ever-be-like-this-house-remix",
  },
  {
    id: "aj-tracey-naila-conducta-edit",
    title: "AJ Tracey - Naila (Conducta Edit)",
    artist: "jude-noon-790532112",
    url: "https://soundcloud.com/jude-noon-790532112/aj-tracey-naila-conducta-edit",
  },
  {
    id: "1-2-step-ciara-remix",
    title: "1, 2 Step (Ciara Remix)",
    artist: "samgellaitry",
    url: "https://soundcloud.com/samgellaitry/1-2-step-ciara-remix",
  },
  {
    id: "pharrell-and-kanye-west-number",
    title: "Pharrell and Kanye West - Number",
    artist: "samgellaitry",
    url: "https://soundcloud.com/samgellaitry/pharrell-and-kanye-west-number",
  },
  {
    id: "chief-keef-f-lil-durk-gotta",
    title: "Chief Keef & Lil Durk - Gotta",
    artist: "2hunned",
    url: "https://soundcloud.com/2hunned/chief-keef-f-lil-durk-gotta",
  },
  {
    id: "nba-youngboy-turnt-up-prod",
    title: "NBA YoungBoy - Turnt Up",
    artist: "user-927325574",
    url: "https://soundcloud.com/user-927325574/nba-youngboy-turnt-up-prod",
  },
  {
    id: "kanye-west-white-dress-other",
    title: "Kanye West - White Dress",
    artist: "sonboronic-1",
    url: "https://soundcloud.com/sonboronic-1/kanye-west-white-dress-other",
  },
]

export default function EasterEgg() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // SIMPLIFIED POSITIONING - Start in center, move predictably
  const [x, setX] = useState(300)
  const [y, setY] = useState(200)
  const [dx, setDx] = useState(2)
  const [dy, setDy] = useState(1.5)

  const intervalRef = useRef<NodeJS.Timeout>()

  // SIMPLE ANIMATION LOOP - No complex RAF, just setInterval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setX((prevX) => {
        const newX = prevX + dx
        const maxX = window.innerWidth - 60

        if (newX <= 20 || newX >= maxX) {
          setDx(-dx)
          return Math.max(20, Math.min(maxX, newX))
        }
        return newX
      })

      setY((prevY) => {
        const newY = prevY + dy
        const maxY = window.innerHeight - 100 // Leave room for taskbar

        if (newY <= 20 || newY >= maxY) {
          setDy(-dy)
          return Math.max(20, Math.min(maxY, newY))
        }
        return newY
      })
    }, 16) // ~60fps

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [dx, dy])

  // Reset position on window resize
  useEffect(() => {
    const handleResize = () => {
      setX(Math.min(x, window.innerWidth - 60))
      setY(Math.min(y, window.innerHeight - 100))
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [x, y])

  const loadRandomTrack = () => {
    setIsLoading(true)
    const randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    setCurrentTrack(randomTrack)
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleClick = () => {
    setIsModalOpen(true)
    if (!currentTrack) {
      loadRandomTrack()
    }
  }

  const buildEmbedUrl = (track: Track) => {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  }

  return (
    <>
      {/* MARIO BOX - SIMPLIFIED POSITIONING */}
      <div
        onClick={handleClick}
        style={{
          position: "fixed",
          left: `${x}px`,
          top: `${y}px`,
          zIndex: 9999, // MAXIMUM Z-INDEX
          width: "50px",
          height: "50px",
          background: "linear-gradient(135deg, #ffd700 0%, #ffb347 50%, #ffa500 100%)",
          border: "3px solid #8b4513",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "inset 3px 3px 0px rgba(255, 255, 255, 0.6), inset -3px -3px 0px rgba(0, 0, 0, 0.4), 3px 3px 12px rgba(0, 0, 0, 0.5)",
          cursor: "pointer",
          fontSize: "28px",
          fontWeight: "900",
          color: "#8b4513",
          textShadow: "2px 2px 0px rgba(255, 255, 255, 0.8), -1px -1px 0px rgba(0, 0, 0, 0.3)",
          userSelect: "none",
          transition: "transform 0.1s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)"
        }}
      >
        ?
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: "32rem",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                backgroundColor: "#374151",
                borderBottom: "1px solid #4b5563",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "24px" }}>🎵</span>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "white", margin: 0 }}>
                    Digging in the Crates
                  </h2>
                  <p style={{ fontSize: "14px", color: "#9ca3af", margin: 0 }}>
                    RAF's SoundCloud Gems • {SOUNDCLOUD_TRACKS.length} tracks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  color: "#9ca3af",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#4b5563"
                  e.currentTarget.style.color = "white"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent"
                  e.currentTarget.style.color = "#9ca3af"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "16px" }}>
              {isLoading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px 0",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      border: "2px solid #06b6d4",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  ></div>
                  <span style={{ marginLeft: "12px", color: "white" }}>Loading track...</span>
                </div>
              ) : currentTrack ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "white",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {currentTrack.title}
                      </h3>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#9ca3af",
                          margin: 0,
                        }}
                      >
                        {currentTrack.artist}
                      </p>
                    </div>
                    <button
                      onClick={loadRandomTrack}
                      disabled={isLoading}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#06b6d4",
                        color: "black",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "500",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#0891b2"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#06b6d4"
                      }}
                    >
                      <Shuffle size={16} />
                      Next Track
                    </button>
                  </div>

                  <div style={{ width: "100%" }}>
                    <iframe
                      width="100%"
                      height="166"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      src={buildEmbedUrl(currentTrack)}
                      style={{ width: "100%", borderRadius: "6px" }}
                      key={currentTrack.id}
                    />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px 0",
                  }}
                >
                  <button
                    onClick={loadRandomTrack}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#06b6d4",
                      color: "black",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#0891b2"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#06b6d4"
                    }}
                  >
                    Start Discovery
                  </button>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  color: "#6b7280",
                  paddingTop: "8px",
                  borderTop: "1px solid #374151",
                  marginTop: "16px",
                }}
              >
                <span>Click outside to close • ESC to exit</span>
                {currentTrack && (
                  <a
                    href={currentTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#22d3ee",
                      textDecoration: "underline",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#06b6d4"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#22d3ee"
                    }}
                  >
                    View on SoundCloud →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animation for spinner */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
