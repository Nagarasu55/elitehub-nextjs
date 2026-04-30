
export const getDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();


    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";

    // Show day name if within last 7 days
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));



    if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" }); // "Monday"

    // Older — show full date
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
};