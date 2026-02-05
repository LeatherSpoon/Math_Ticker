using System;
using System.Drawing;
using System.Windows.Forms;

namespace MathTicker;

public sealed class TickerForm : Form
{
    private readonly Label _valueLabel;
    private readonly Label _statusLabel;
    private readonly Timer _timer;
    private int _value;

    public TickerForm()
    {
        Text = "Math Ticker";
        MinimumSize = new Size(520, 320);
        StartPosition = FormStartPosition.CenterScreen;

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 5,
            Padding = new Padding(20),
        };

        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 90));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 33));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 33));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 34));

        _valueLabel = new Label
        {
            Dock = DockStyle.Fill,
            Font = new Font("Segoe UI", 34, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
        };

        _statusLabel = new Label
        {
            Dock = DockStyle.Fill,
            Font = new Font("Segoe UI", 12, FontStyle.Regular),
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.DimGray,
        };

        layout.SetColumnSpan(_valueLabel, 2);
        layout.SetColumnSpan(_statusLabel, 2);

        var startButton = CreateActionButton("Start", (_, _) => StartTicker());
        var pauseButton = CreateActionButton("Pause", (_, _) => PauseTicker());
        var resetButton = CreateActionButton("Reset", (_, _) => ResetTicker());
        var addButton = CreateActionButton("+1", (_, _) => AdjustValue(1));
        var subtractButton = CreateActionButton("-1", (_, _) => AdjustValue(-1));

        layout.Controls.Add(_valueLabel, 0, 0);
        layout.Controls.Add(_statusLabel, 0, 1);
        layout.Controls.Add(startButton, 0, 2);
        layout.Controls.Add(pauseButton, 1, 2);
        layout.Controls.Add(resetButton, 0, 3);
        layout.Controls.Add(addButton, 1, 3);
        layout.Controls.Add(subtractButton, 0, 4);
        layout.SetColumnSpan(subtractButton, 2);

        Controls.Add(layout);

        _timer = new Timer { Interval = 1000 };
        _timer.Tick += (_, _) => AdjustValue(1);

        UpdateLabels("Ready");
    }

    private Button CreateActionButton(string text, EventHandler handler)
    {
        var button = new Button
        {
            Text = text,
            Dock = DockStyle.Fill,
            Font = new Font("Segoe UI", 12, FontStyle.Bold),
            BackColor = Color.WhiteSmoke,
        };

        button.Click += handler;
        return button;
    }

    private void StartTicker()
    {
        _timer.Start();
        UpdateLabels("Running");
    }

    private void PauseTicker()
    {
        _timer.Stop();
        UpdateLabels("Paused");
    }

    private void ResetTicker()
    {
        _timer.Stop();
        _value = 0;
        UpdateLabels("Reset");
    }

    private void AdjustValue(int delta)
    {
        _value += delta;
        UpdateLabels(_timer.Enabled ? "Running" : "Manual");
    }

    private void UpdateLabels(string status)
    {
        _valueLabel.Text = _value.ToString("N0");
        _statusLabel.Text = $"Status: {status} · Updated {DateTime.Now:HH:mm:ss}";
    }
}
