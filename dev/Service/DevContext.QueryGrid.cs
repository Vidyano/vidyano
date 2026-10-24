using Bogus;
using Dev.Service.Model;

namespace Dev.Service;

/// <summary>
/// Read-only test data for the vi-query-grid Playwright tests (packages/vidyano/tests/query-grid/README.md).
/// Everything is rebuilt deterministically by <see cref="InitializeQueryGridData"/>, which runs from
/// <see cref="Initialize"/> (on startup and on every PersistentObject.ResetTest).
/// </summary>
public partial class DevContext
{
    public const int ReorderItemsSeed = 1003;
    public const int ReorderItemsLargeSeed = 1004;

    public const int ReorderItemCount = 12;
    public const int ReorderItemLargeCount = 250;
    public const int ReorderItemLargeIdOffset = 1000;

    public static List<ReorderItem> _reorderItems = [];
    public static List<ReorderItem> _reorderItemsLarge = [];

    static void InitializeQueryGridData()
    {
        _reorderItems = CreateReorderItems(ReorderItemsSeed, ReorderItemCount, 0, "00");
        _reorderItemsLarge = CreateReorderItems(ReorderItemsLargeSeed, ReorderItemLargeCount, ReorderItemLargeIdOffset, "000");
    }

    /// <summary>
    /// Both reorder lists (used to load a single item by id; ids do not overlap).
    /// </summary>
    public IQueryable<ReorderItem> AllReorderItems => _reorderItems.Concat(_reorderItemsLarge).AsQueryable();

    public IQueryable<ReorderItem> ReorderItems() => _reorderItems.AsQueryable();

    public IQueryable<ReorderItem> ReorderItemsLarge() => _reorderItemsLarge.AsQueryable();

    static List<ReorderItem> CreateReorderItems(int seed, int count, int idOffset, string nameFormat)
    {
        var faker = new Faker<ReorderItem>("en")
            .UseSeed(seed)
            .RuleFor(r => r.Id, f => idOffset + f.IndexFaker + 1)
            .RuleFor(r => r.Name, f => $"Item {(f.IndexFaker + 1).ToString(nameFormat)}")
            .RuleFor(r => r.Description, f => f.Commerce.ProductName())
            .RuleFor(r => r.Offset, f => (f.IndexFaker + 1) * 10);

        return faker.Generate(count);
    }
}
