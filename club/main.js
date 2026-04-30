import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";

const DISCOVERY_CHANNEL = "designftw-26";

function setup(props) {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const clubId = computed(() => props.clubId);

    const { objects: allClubObjects } = useGraffitiDiscover(
        [DISCOVERY_CHANNEL],
        { properties: {
            value: {
                required: ["activity","type","channel","title"],
                properties: {
                    activity: { const: "Create" },
                    type: { const: "Club" },
                    channel: { type: "string" },
                    title: { type: "string" }
                }
            }
        } }
    );
    const clubTitle = computed(() => allClubObjects.value.find((c) => c.value.channel === clubId.value)?.value.title || "Club");

    const myMessage = ref("");
    const isSending = ref(false);
    const isDeleting = ref(new Set());

    const { objects: messageObjects, isFirstPoll: areMessagesLoading } = useGraffitiDiscover(
        () => clubId.value ? [clubId.value] : [],
        { properties: { value: { required: ["content","published"], properties: { content: { type: "string" }, published: { type: "number" } } } } },
        undefined, true
    );

    const sortedMessages = computed(() =>
        messageObjects.value.toSorted((a, b) => a.value.published - b.value.published)
    );

    async function sendMessage() {
        if (!myMessage.value.trim() || !clubId.value) return;
        isSending.value = true;
        try {
            await graffiti.post({ value: { content: myMessage.value.trim(), published: Date.now() }, channels: [clubId.value] }, session.value);
            myMessage.value = "";
        }
        finally {
            isSending.value = false;
        }
    }

    async function deleteMessage(msg) {
        isDeleting.value.add(msg.url);
        try {
            await graffiti.delete(msg, session.value);
        }
        finally {
            isDeleting.value.delete(msg.url);
        }
    }

    function formatTime(ts) {
        return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return {
        clubTitle,
        myMessage,
        isSending,
        isDeleting,
        sortedMessages,
        areMessagesLoading,
        sendMessage,
        deleteMessage,
        formatTime,
    };
}

    export default async () => ({
    props: ["clubId"],
    setup,
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
