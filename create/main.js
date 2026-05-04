import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";
import { useRouter } from "vue-router";

const DISCOVERY_CHANNEL = "designftw-26";

function setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const router = useRouter();

    const newClubName = ref("");
    const newClubDescription = ref("");
    const selectedFile = ref(null);
    const previewUrl = ref(null);
    const isCreating = ref(false);

    const joinActorChannel = computed(() =>
        session.value ? `${session.value.actor}/clubs` : null
    );

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
        selectedFile.value = file;
        previewUrl.value = URL.createObjectURL(file);
        }
    }

    async function createClub() {
        if (!newClubName.value.trim() || !newClubDescription.value.trim()) return;
        isCreating.value = true;
        try {
        const newChannel = crypto.randomUUID();

        let iconUrl = null;
        if (selectedFile.value) {
            iconUrl = await graffiti.postMedia({ data: selectedFile.value }, session.value);
        }

        await graffiti.post({
            value: {
            activity: "Create",
            type: "Club",
            channel: newChannel,
            title: newClubName.value.trim(),
            description: newClubDescription.value.trim(),
            icon: iconUrl,
            published: Date.now(),
            },
            channels: [DISCOVERY_CHANNEL],
        }, session.value);

        await graffiti.post({
            value: {
            activity: "Join",
            target: newChannel,
            title: newClubName.value.trim(),
            published: Date.now(),
            },
            channels: [joinActorChannel.value],
        }, session.value);

        router.push(`/club/${newChannel}`);
        } finally {
        isCreating.value = false;
        }
    }

    return {
        newClubName,
        newClubDescription,
        selectedFile,
        previewUrl,
        isCreating,
        handleFileSelect,
        createClub
    };
}

export default async () => ({
    setup,
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
