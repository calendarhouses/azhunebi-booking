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
    roomCategories,
    selectedCategoryId,
    setSelectedCategoryId,
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

  const cats = visibleRoomCategories(runtime?.roomCategoriesList);
  const groups = groupRoomsByCategory(rooms, cats);
  const showHeads = !selectedCategoryId && cats.length > 1 && groups.some((g) => Boolean(g.title));
  const showCats = roomCategories.length > 1;

  return (
    <>
      {showCats ? (
        <div className="public-cabin-cats" role="tablist" aria-label="Категорії житла">
          <button
            type="button"
            role="tab"
            aria-selected={!selectedCategoryId}
            className={`public-cabin-cats__btn${!selectedCategoryId ? " is-active" : ""}`}
            onClick={() => setSelectedCategoryId(null)}
          >
            Усі
          </button>
          {roomCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === cat.id}
              className={`public-cabin-cats__btn${selectedCategoryId === cat.id ? " is-active" : ""}`}
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.id} className="public-cabin-group">
          {showHeads && group.title ? (
            <header className="public-cabin-group__head">
              <span className="public-cabin-group__rule" aria-hidden />
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
