import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";

const DISCOVERY_CHANNEL = "designftw-26";

function setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const searchQuery = ref("");

    const { objects: allClubObjects } = useGraffitiDiscover(
        [DISCOVERY_CHANNEL],
        { properties: { value: { required: ["activity","type","channel","title","published"], properties: { activity: { const: "Create" }, type: { const: "Club" }, channel: { type: "string" }, title: { type: "string" }, published: { type: "number" } } } } }
    );

    const joinActorChannel = computed(() => session.value ? `${session.value.actor}/clubs` : null);
    const { objects: joinObjects } = useGraffitiDiscover(
        () => joinActorChannel.value ? [joinActorChannel.value] : [],
        { properties: { value: { required: ["activity","target"], properties: { activity: { const: "Join" }, target: { type: "string" } } } } }
    );

    const joinedChannels = computed(() => {
        const s = new Set();
        for (const obj of joinObjects.value) s.add(obj.value.target);
        return s;
    });

    const filteredAllClubs = computed(() => {
        const q = searchQuery.value.toLowerCase();
        return q ? allClubObjects.value.filter((c) => c.value.title.toLowerCase().includes(q)) : allClubObjects.value;
    });

    async function joinClub(clubObject) {
        await graffiti.post(
        {
            value: { activity: "Join", target: clubObject.value.channel, title: clubObject.value.title, published: Date.now() }, channels: [joinActorChannel.value]
        },
        session.value
        );
    }

    return {
        searchQuery, filteredAllClubs, joinedChannels, joinClub
    };
}

export default async () => ({
    setup,
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
