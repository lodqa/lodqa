require 'spec_helper'
require_relative '../enjuparse'

describe "EnjuParse" do
  context "for passing of invaid enju accessor" do
    it "(nil) should raise error" do
      expect { EnjuParse.new(nil, "a sentence") }.to raise_error(RuntimeError, "An instance of RestClient::Resource has to be passed for the first argument.")
    end
    it "(string) should raise error" do
      expect { EnjuParse.new("http://URL.in.string", "a sentence") }.to raise_error(RuntimeError, "An instance of RestClient::Resource has to be passed for the first argument.")
    end
  end

  context "for passing of invaid query" do
    before do
      @enju_accessor = RestClient::Resource.new "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"
    end

    it "should raise error: empty input" do
      expect { EnjuParse.new(@enju_accessor, "") }.to raise_error(RuntimeError, "Empty input.")
      expect { EnjuParse.new(@enju_accessor, "  ") }.to raise_error(RuntimeError, "Empty input.")
    end
  end

  context "with a valid enju accessor" do
    before do
      @enju_accessor = RestClient::Resource.new "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"
    end

    context "with a normal imperative sentence" do
      before do
        @p = EnjuParse.new(@enju_accessor, "Show me devices used to treat heart failure.")
                                          # 01234567890123456789012345678901234567890123
      end

      it "should return the right length of tparses array" do
        @p.tparses.length.should eql 8
      end

      it "should find the right root" do
        @p.root.should eql 0
      end

      it "should find the right focus" do
        @p.focus.should eql 2
      end

      it "should find the right noun chunk heads" do
        @p.heads.should eql([2, 7])
      end

      it "should find the right word span of noun chunks" do
        @p.bnc_span_word_index[2].should eql([2, 2])
        @p.bnc_span_word_index[7].should eql([6, 7])
      end

      it "should find the right caret span of noun chunks" do
        @p.bnc_span_caret_index[2].should eql([8, 15])
        @p.bnc_span_caret_index[7].should eql([30, 43])
      end

      it "should find right relations" do
        @p.rels.should include([2, [3, 5], 7])
      end
    end

    context "with a normal interogative sentence" do
      before do
        @p = EnjuParse.new(@enju_accessor, "what genes are associated with kabuki syndrome?")
                                          # 01234567890123456789012345678901234567890123456789
      end

      it "should return the right length of tparses array" do
        @p.tparses.length.should eql 7
      end

      it "should find the right root" do
        @p.root.should eql 3
      end

      it "should find the right focus" do
        @p.focus.should eql 1
      end

      it "should find the right noun chunk heads" do
        @p.heads.should eql([1, 6])
      end

      it "should find the right word span of noun chunks" do
        @p.bnc_span_word_index[1].should eql([1, 1])
        @p.bnc_span_word_index[6].should eql([5, 6])
      end

      it "should find the right caret span of noun chunks" do
        @p.bnc_span_caret_index[1].should eql([5, 10])
        @p.bnc_span_caret_index[6].should eql([31, 46])
      end

      it "should find right relations" do
        @p.rels.should include([1, [3, 4], 6])
      end
    end

  end
end
