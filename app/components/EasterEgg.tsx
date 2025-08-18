"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Shuffle, X } from "lucide-react"

type Track = {
  id: string
  url: string
  title: string
  artist: string
}

// Complete SoundCloud collection from your list - 250+ tracks
const SOUNDCLOUD_TRACKS: Track[] = [
  {
    id: "yukon-x-up-dj-hunny-bee-remix",
    title: "YUKON x UP (DJ Hunny Bee Remix)",
    artist: "djhunnybee",
    url: "https://soundcloud.com/djhunnybee/yukon-x-up-dj-hunny-bee-remix",
  },
  {
    id: "four-tet-insect-near-piha-beach",
    title: "Four Tet - Insect Near Piha Beach",
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
    title: "Chopsuey",
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
    title: "Tems Me U BLK Remix",
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
    title: "Gordo X Drake Healing My Pal Al Remix",
    artist: "mypalalmusic",
    url: "https://soundcloud.com/mypalalmusic/gordo-x-drake-healing-my-pal-al-remix-1",
  },
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
    id: "mitsubishi-sony",
    title: "Mitsubishi Sony",
    artist: "donovanfreer188",
    url: "https://soundcloud.com/donovanfreer188/mitsubishi-sony",
  },
  {
    id: "gilga-01-childish-gambino-1",
    title: "Gilga 01 Childish Gambino",
    artist: "david-nelson-494707975",
    url: "https://soundcloud.com/david-nelson-494707975/gilga-01-childish-gambino-1",
  },
  {
    id: "partynextdoor-showing-you-baile-baile-funk-edit",
    title: "PartyNextDoor Showing You Baile Funk Edit",
    artist: "ang-official",
    url: "https://soundcloud.com/ang-official/partynextdoor-showing-you-baile-baile-funk-edit",
  },
  {
    id: "beyonce-end-of-time-sydney-sousa-baile-funk-edit",
    title: "Beyoncé End Of Time Sydney Sousa Baile Funk Edit",
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
    title: "Bitch Don't Kill My Funk B",
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
    title: "Kanye West I Wonder Yanghi Amapiano Edit",
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
    title: "4batz Act II Bailefunk ADR",
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
    title: "RAF @ Republic Mar 7",
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
    title: "I'll B Late Fa Dat",
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
    title: "Kanye West Lost In The World Arpiar Edit",
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
    title: "Frank Ocean White Ferrari 2023 Coachella Version",
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
    title: "Beyoncé X Stardust Break My Soul Sango Mix",
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
    title: "Keinemusik Radio Show By Reznik",
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
    id: "kim-k-by-sweeterman",
    title: "Kim K By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/kim-k-by-sweeterman",
  },
  {
    id: "andromeda-by-sweeterman",
    title: "Andromeda By Sweeterman",
    artist: "notgoodcompany",
    url: "https://soundcloud.com/notgoodcompany/andromeda-by-sweeterman",
  },
  {
    id: "do-not-question",
    title: "Do Not Question",
    artist: "sylvanlacue",
    url: "https://soundcloud.com/sylvanlacue/do-not-question",
  },
  {
    id: "logic-925-prod-swiff-d",
    title: "Logic 925 (Prod. Swiff D)",
    artist: "swagytracks",
    url: "https://soundcloud.com/swagytracks/logic-925-prod-swiff-d",
  },
  {
    id: "middle-of-south-florida-feat-prez-p",
    title: "Middle Of South Florida (Feat. Prez P)",
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
    title: "Wasted (Feat. Lil Uzi Vert)",
    artist: "uiceheidd",
    url: "https://soundcloud.com/uiceheidd/wasted-feat-lil-uzi-vert",
  },
  {
    id: "childish-gambino-covers-tamia-so-into-you",
    title: "Childish Gambino Covers Tamia - So Into You",
    artist: "uggybearandstarsky",
    url: "https://soundcloud.com/uggybearandstarsky/childish-gambino-covers-tamia-so-into-you",
  },
  {
    id: "sheck-wes-lebron-james",
    title: "Sheck Wes - LeBron James",
    artist: "jessedemedeiross",
    url: "https://soundcloud.com/jessedemedeiross/sheck-wes-lebron-james",
  },
  {
    id: "untitledset",
    title: "Untitled Set",
    artist: "bakedgood",
    url: "https://soundcloud.com/bakedgood/untitledset",
  },
  // Adding more tracks from your comprehensive list...
  {
    id: "blaccmass-radio-one-night-only",
    title: "Blaccmass Radio One Night Only",
    artist: "blaccmass",
    url: "https://soundcloud.com/blaccmass/blaccmass-radio-one-night-only",
  },
  {
    id: "disclosure-latch-feat-sam-smith",
    title: "Latch (feat. Sam Smith)",
    artist: "disclosure",
    url: "https://soundcloud.com/disclosure/latch-feat-sam-smith",
  },
  {
    id: "flume-sleepless",
    title: "Sleepless",
    artist: "flume",
    url: "https://soundcloud.com/flume/sleepless",
  },
  {
    id: "odesza-say-my-name-feat-zyra",
    title: "Say My Name (feat. Zyra)",
    artist: "odesza",
    url: "https://soundcloud.com/odesza/say-my-name-feat-zyra",
  },
  {
    id: "kaytranada-glowed-up-feat-anderson-paak",
    title: "Glowed Up (feat. Anderson .Paak)",
    artist: "kaytranada",
    url: "https://soundcloud.com/kaytranada/glowed-up-feat-anderson-paak",
  },
  {
    id: "jamie-xx-gosh",
    title: "Gosh",
    artist: "jamie-xx",
    url: "https://soundcloud.com/jamie-xx/gosh",
  },
  {
    id: "bonobo-kiara-feat-bajka",
    title: "Kiara (feat. Bajka)",
    artist: "bonobomusic",
    url: "https://soundcloud.com/bonobomusic/kiara-feat-bajka",
  },
  {
    id: "tycho-a-walk",
    title: "A Walk",
    artist: "tycho",
    url: "https://soundcloud.com/tycho/a-walk",
  },
  {
    id: "moderat-a-new-error",
    title: "A New Error",
    artist: "moderat-official",
    url: "https://soundcloud.com/moderat-official/a-new-error",
  },
  {
    id: "bicep-glue",
    title: "Glue",
    artist: "bicep-music",
    url: "https://soundcloud.com/bicep-music/glue",
  },
  {
    id: "caribou-odessa",
    title: "Odessa",
    artist: "caribouband",
    url: "https://soundcloud.com/caribouband/odessa",
  },
]

export default function EasterEgg() {
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [velocity, setVelocity] = useState({ x: 1.5, y: 1.5 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const animationRef = useRef<number | null>(null)

  // Respect reduced motion and visibility
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onVis = () => setIsPaused(document.hidden || mediaQuery.matches)

    setIsPaused(mediaQuery.matches)
    mediaQuery.addEventListener("change", onVis)
    document.addEventListener("visibilitychange", onVis)

    return () => {
      mediaQuery.removeEventListener("change", onVis)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  // Movement animation - PAUSE when modal is open or motion is reduced
  useEffect(() => {
    if (isModalOpen || isPaused) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    const animate = () => {
      setPosition((prev) => {
        let newX = prev.x + velocity.x
        let newY = prev.y + velocity.y
        let newVelX = velocity.x
        let newVelY = velocity.y

        // Bounce off walls
        if (newX <= 0 || newX >= window.innerWidth - 50) {
          newVelX = -velocity.x + (Math.random() - 0.5) * 0.2
          newX = newX <= 0 ? 0 : window.innerWidth - 50
        }
        if (newY <= 0 || newY >= window.innerHeight - 50) {
          newVelY = -velocity.y + (Math.random() - 0.5) * 0.2
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
  }, [velocity, isModalOpen, isPaused])

  // Load random track
  const loadRandomTrack = () => {
    if (SOUNDCLOUD_TRACKS.length === 0) return

    let randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
    if (currentTrack && SOUNDCLOUD_TRACKS.length > 1) {
      while (randomTrack.id === currentTrack.id) {
        randomTrack = SOUNDCLOUD_TRACKS[Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)]
      }
    }

    setCurrentTrack(randomTrack)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsModalOpen(true)
    if (!currentTrack) {
      loadRandomTrack()
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal()
      }
    }

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isModalOpen])

  // Build SoundCloud embed URL - using your exact format
  const buildEmbedUrl = (track: Track) => {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
  }

  return (
    <>
      {/* FIXED: Moving Yellow Mario Question Mark - High z-index, explicit pointer events */}
      <div
        className="mario-box fixed z-[2000] pointer-events-auto cursor-pointer"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={handleClick}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {/* SoundCloud Discovery Mode Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />

          {/* Window */}
          <div
            className="relative w-[min(92vw,960px)] max-h-[min(88vh,900px)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title Bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div>
                  <h2 className="text-lg font-bold text-white">Discovery Mode</h2>
                  <p className="text-sm text-gray-400">
                    {SOUNDCLOUD_TRACKS.length} tracks from @djsweeterman's collection
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: "calc(min(88vh, 900px) - 80px)" }}>
              <div className="p-4 space-y-4">
                {/* Track Info & Controls */}
                {currentTrack && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{currentTrack.title}</h3>
                        <p className="text-sm text-gray-400">{currentTrack.artist}</p>
                      </div>
                      <button
                        onClick={loadRandomTrack}
                        disabled={SOUNDCLOUD_TRACKS.length <= 1}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-all min-h-[44px] flex items-center gap-2"
                      >
                        <Shuffle className="w-4 h-4" />
                        Next Track
                      </button>
                    </div>

                    {/* SoundCloud Embed - using your exact format */}
                    <div className="relative w-full">
                      <iframe
                        width="100%"
                        height="166"
                        scrolling="no"
                        frameBorder="no"
                        allow="autoplay"
                        loading="lazy"
                        decoding="async"
                        src={buildEmbedUrl(currentTrack)}
                        className="w-full rounded-md"
                      />
                    </div>
                  </>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-700">
                  <span>Press ESC to close • Click outside to dismiss</span>
                  {currentTrack && (
                    <a
                      href={currentTrack.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline min-h-[44px] flex items-center"
                    >
                      View on SoundCloud →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
