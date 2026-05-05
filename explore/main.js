import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";

const DISCOVERY_CHANNEL = "designftw-26";

function setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const searchQuery = ref("");
    const sortField = ref("date");
    const sortDir = ref("desc");
    const filterBy = ref("all");
    const viewMode = ref("list");
    const showSort = ref(false);
    const showFilter = ref(false);

    const filterLabel = computed(() => {
        if (filterBy.value === 'joined') return 'Joined';
        if (filterBy.value === 'notjoined') return 'Not joined';
        return 'Filter';
    });

    const sortLabel = computed(() => {
        const dir = sortDir.value === 'asc' ? '↑' : '↓';
        return sortField.value === 'name' ? `Name ${dir}` : `Date ${dir}`;
    });

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

    const processedClubs = computed(() => {
        let clubs = [...allClubObjects.value];
        if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        clubs = clubs.filter(c => c.value.title.toLowerCase().includes(q));
        }
        if (filterBy.value === 'joined') clubs = clubs.filter(c => joinedChannels.value.has(c.value.channel));
        else if (filterBy.value === 'notjoined') clubs = clubs.filter(c => !joinedChannels.value.has(c.value.channel));
        if (sortField.value === 'name') {
        clubs.sort((a, b) => sortDir.value === 'asc'
            ? a.value.title.localeCompare(b.value.title)
            : b.value.title.localeCompare(a.value.title));
        } else {
        clubs.sort((a, b) => sortDir.value === 'asc'
            ? a.value.published - b.value.published
            : b.value.published - a.value.published);
        }
        return clubs;
    });

    async function joinClub(clubObject) {
        await graffiti.post(
        { value: { activity: "Join", target: clubObject.value.channel, title: clubObject.value.title, published: Date.now() }, channels: [joinActorChannel.value] },
        session.value
        );
    }

    return {
        searchQuery,
        sortField,
        sortDir,
        filterBy,
        viewMode,
        showSort,
        sortLabel,
        processedClubs,
        joinedChannels,
        joinClub,
        showFilter,
        filterLabel,
};
}

export default async () => ({
    setup,
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
