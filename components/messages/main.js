import { computed } from "vue";

function setup(props) {
    const formattedTime = computed(() =>
        new Date(props.published).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
    return { formattedTime };
}

export default async () => ({
    props: ["actor", "content", "published", "isOwner", "deleting", "saved"],
    emits: ["delete", "save"],
    setup,
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) => r.text()),
});
