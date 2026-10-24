namespace Dev.Service.Model;

/// <summary>
/// Read-only test data for the vi-query-grid continuation tests (query QueryGrid_Continuation): an unknown total that is
/// paged with continuation tokens.
/// </summary>
public class ContinuationRow
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Department { get; set; } = null!;

    public decimal Amount { get; set; }

    public DateTime Date { get; set; }
}
