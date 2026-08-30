"use client";

import { groupRoomsByCategory, houseWord, visibleRoomCategories } from "@/lib/admin/roomCategories";
import { usePublicBooking } from "./PublicBookingProvider";
import { CabinCardMobile } from "./CabinCardMobile";
import { DesktopCabinCard } from "./desktop/DesktopCabinCard";
import { PublicCabinsEmptyState } from "./PublicAvailabilityFilter";

export function PublicCabinList({ layout }: { layout: "mobile" | "desktop" }) {
  const {
    runtime,
    filteredRooms,
    listFilterActive,
    selectedCategoryId,
    openDrawer,
    getNextFreeForRoom,
  } = usePublicBooking();

  const rooms = filteredRooms;
  const showEmpty = Boolean(runtime && listFilterActive && rooms.length === 0);
  const showLoading = !runtime || runtime.rooms.length === 0;

  if (showLoading) {
    return (
      <div className="loading-state">
        <div className="loader" />
        {!runtime ? "Завантаження…" : "Котеджів не знайдено"}
      </div>
    );
  }

  if (showEmpty) return <PublicCabinsEmptyState />;

  const groups = groupRoomsByCategory(
    rooms,
    visibleRoomCategories(runtime?.roomCategoriesList)
  );
  const showHeads = !selectedCategoryId && groups.some((g) => Boolean(g.title));

  return (
    <>
      {groups.map((group) => (
        <section key={group.id} className="public-cabin-group">
          {showHeads && group.title ? (
            <header className="public-cabin-group__head">
              <h2 className="public-cabin-group__title">{group.title}</h2>
              <span className="public-cabin-group__count">
                {group.rooms.length} {houseWord(group.rooms.length)}
              </span>
            </header>
          ) : null}
          {group.rooms.map((room) =>
            layout === "mobile" ? (
              <CabinCardMobile
                key={room.id}
                room={room}
                customPrices={runtime!.customPrices}
                nextFreeLabel={getNextFreeForRoom(room)}
                onBook={() => openDrawer(room)}
              />
            ) : (
              <DesktopCabinCard
                key={room.id}
                room={room}
                customPrices={runtime!.customPrices}
                nextFreeLabel={getNextFreeForRoom(room)}
                onBook={() => openDrawer(room)}
              />
            )
          )}
        </section>
      ))}
    </>
  );
}
