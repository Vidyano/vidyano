namespace Dev.Service.Model;

/// <summary>
/// Read-only test data for the vi-query-grid data type tests (query QueryGrid_DataTypes).
/// </summary>
public class GridDataType
{
    public int Id { get; set; }

    public string? Text { get; set; }

    public string? MultiLine { get; set; }

    public int Int32 { get; set; }

    public int? NullableInt32 { get; set; }

    public decimal Decimal { get; set; }

    public decimal DecimalFormatted { get; set; }

    public double Double { get; set; }

    public long Int64 { get; set; }

    public DateTime DateTime { get; set; }

    public DateTimeOffset DateTimeOffset { get; set; }

    public TimeSpan Time { get; set; }

    public DateTime? NullableDate { get; set; }

    public bool? NullableBoolean { get; set; }

    public bool? NullableBooleanPlain { get; set; }

    public bool YesNo { get; set; }

    public byte[]? Image { get; set; }

    public string? CommonMark { get; set; }

    public string? Secret { get; set; }
}
