import { fetchTenants } from "@/lib/gas-api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tenants = await fetchTenants();

  return (
    <main className="p-10 font-sans max-w-3xl mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 text-center">
        Система «ХАТА» працює! 🚀
      </h1>

      <div className="space-y-6">
        {!tenants || tenants.length === 0 ? (
          <p className="text-gray-500 text-center">У базі поки немає жодного комплексу...</p>
        ) : (
          tenants.map((tenant) => {
            const settings = tenant.tenant_settings?.[0] || {};
            const branding = settings.branding || {};
            const rooms = (settings.rooms_list || []) as Array<{
              id: number;
              name: string;
              capacity: number;
              base_price?: number;
            }>;
            const primaryColor = (branding.primary_color as string) || "#3b82f6";

            return (
              <div
                key={tenant.id}
                className="overflow-hidden bg-white shadow-lg rounded-2xl border border-gray-100"
              >
                <div className="p-6 text-white" style={{ backgroundColor: primaryColor }}>
                  <h2 className="text-2xl font-bold">{tenant.name}</h2>
                  <p className="text-sm opacity-90 mt-1">Субдомен: {tenant.subdomain}.hata.ua</p>
                </div>

                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    Кімнати комплексу:
                  </h3>

                  {rooms.length === 0 ? (
                    <p className="text-gray-500 italic">Не знайдено жодної кімнати...</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {rooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100"
                        >
                          <div>
                            <p className="font-bold text-gray-800">{room.name}</p>
                            <p className="text-sm text-gray-500">
                              Місткість: до {room.capacity} гостей
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg" style={{ color: primaryColor }}>
                              {room.base_price} грн
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
