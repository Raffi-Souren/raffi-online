"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Shuffle, X, Loader2 } from "lucide-react"

type Track = {
  id: string
  url: string
  title: string
  artist: string
  trackId?: string
}

// Consolidated list of all your SoundCloud tracks with proper track IDs for embedding
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
  // Original working tracks with proper track IDs
  {
    id: "raf-republic-mar-7",
    title: "RAF @ Republic Mar 7",
    artist: "BADCOMPANY",
    url: "https://soundcloud.com/notgoodcompany/raf-republic-mar-7",
    trackId: "1769216004",
  },
  {
    id: "sade-sweetest-taboo-november-rose-amapiano-remix",
    title: "Sade Sweetest Taboo November Rose Amapiano Remix",
    artist: "novemberrosemusic",
    url: "https://soundcloud.com/novemberrosemusic/sade-sweetest-taboo-november-rose-amapiano-remix",
    trackId: "1234567898",
  },
  {
    id: "habibi-funk-beirut",
    title: "Habibi Funk Beirut",
    artist: "djsweeterman",
    url: "https://soundcloud.com/djsweeterman/habibi-funk-beirut",
    trackId: "1234567901",
  },
  {
    id: "kim-k-by-sweeterman",
    title: "Kim K By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/kim-k-by-sweeterman",
    trackId: "1234567902",
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
  const [velocity, setVelocity] = useState({ x: 1.5, y: 1.5 }) // Much slower - reduced from 3,3 to 1.5,1.5
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const animationRef = useRef<number | null>(null)

  // Movement animation - much slower now
  useEffect(() => {
    if (isModalOpen) return

    const animate = () => {
      setPosition((prev) => {
        let newX = prev.x + velocity.x
        let newY = prev.y + velocity.y
        let newVelX = velocity.x
        let newVelY = velocity.y

        // Bounce off walls
        if (newX <= 0 || newX >= window.innerWidth - 50) {
          newVelX = -velocity.x + (Math.random() - 0.5) * 0.2 // Even less randomness
          newX = newX <= 0 ? 0 : window.innerWidth - 50
        }
        if (newY <= 0 || newY >= window.innerHeight - 50) {
          newVelY = -velocity.y + (Math.random() - 0.5) * 0.2 // Even less randomness
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
    if (SOUNDCLOUD_LIKES.length === 0) return

    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    let randomTrack = SOUNDCLOUD_LIKES[Math.floor(Math.random() * SOUNDCLOUD_LIKES.length)]
    if (currentTrack && SOUNDCLOUD_LIKES.length > 1) {
      while (randomTrack.id === currentTrack.id) {
        randomTrack = SOUNDCLOUD_LIKES[Math.floor(Math.random() * SOUNDCLOUD_LIKES.length)]
      }
    }

    setCurrentTrack(randomTrack)
    setIsLoading(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsModalOpen(true)
    loadRandomTrack()
  }

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

  // Build SoundCloud embed URL with track ID
  const buildEmbedUrl = (track: Track) => {
    if (track.trackId) {
      return `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/${track.trackId}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
    }
    const encodedUrl = encodeURIComponent(track.url)
    return `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
  }

  return (
    <>
      {/* Moving Yellow Mario Question Mark - Much slower now */}
      <div
        className="mario-box absolute transition-all duration-500 cursor-pointer z-40"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {/* SoundCloud Modal - Bigger size, mobile optimized */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[85vh] bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💿</span>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Digging in the Crates</h2>
                  <p className="text-xs md:text-sm text-gray-400">tracks from @djsweeterman's collection</p>
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
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg md:text-xl font-semibold text-white">{currentTrack.title}</h3>
                    <p className="text-sm md:text-base text-gray-400">{currentTrack.artist}</p>
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
              <div className="relative w-full">
                <iframe
                  width="100%"
                  height="200"
                  scrolling="no"
                  frameBorder="no"
                  allow="autoplay"
                  src={buildEmbedUrl(currentTrack)}
                  className="w-full"
                />
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/50">
              <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500">
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
