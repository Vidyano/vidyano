namespace Dev.Service.Model;

/// <summary>
/// Read-only test data for the vi-query-grid reorder tests (queries QueryGrid_Reorder and QueryGrid_ReorderLarge).
/// </summary>
public class ReorderItem
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Description { get; set; } = null!;

    public int Offset { get; set; }
}
